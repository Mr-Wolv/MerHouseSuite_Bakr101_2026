package com.merhouse.service;

import com.merhouse.entity.NotificationDelivery;
import com.merhouse.entity.NotificationDeliveryStage;
import com.merhouse.entity.NotificationProviderStatus;
import com.merhouse.repository.NotificationDeliveryRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;

@Service
public class EmailDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(EmailDeliveryService.class);
    private static final int MAX_RETRY_ATTEMPTS = 3;

    private final JavaMailSender mailSender;
    private final RestClient resendClient;
    private final Clock clock;
    private final NotificationDeliveryRepository deliveryRepository;
    private final TransactionTemplate transactionTemplate;
    private final boolean enabled;
    private final String provider;
    private final String from;
    private final String replyTo;

    public EmailDeliveryService(
        JavaMailSender mailSender,
        @Qualifier("resendRestClient") RestClient resendClient,
        Clock clock,
        NotificationDeliveryRepository deliveryRepository,
        TransactionTemplate transactionTemplate,
        @Value("${merhouse.email.enabled:false}") boolean enabled,
        @Value("${merhouse.email.provider:smtp}") String provider,
        @Value("${merhouse.email.from:}") String from,
        @Value("${merhouse.email.reply-to:}") String replyTo
    ) {
        this.mailSender = mailSender;
        this.resendClient = resendClient;
        this.clock = clock;
        this.deliveryRepository = deliveryRepository;
        this.transactionTemplate = transactionTemplate;
        this.enabled = enabled;
        this.provider = provider != null ? provider.trim().toLowerCase() : "smtp";
        this.from = from;
        this.replyTo = replyTo;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Async fire-and-forget email using plain strings to avoid LazyInitializationException
     * on detached JPA entities. If a deliveryId is provided, the delivery record is updated
     * with the final send status after completion.
     */
    @Async("emailDeliveryExecutor")
    public void sendAndForget(UUID deliveryId, String recipientEmail, String title, String body) {
        EmailDeliveryResult result = sendWithRetry(recipientEmail, title, body);
        if (result.sent()) {
            log.info("Async email sent to {} — provider id: {}", recipientEmail, result.providerMessageId());
        } else {
            log.warn("Async email delivery failed to {} after {} attempt(s): {}",
                recipientEmail, MAX_RETRY_ATTEMPTS, result.error());
        }
        if (deliveryId != null) {
            updateDeliveryRecord(deliveryId, result);
        }
    }

    private EmailDeliveryResult sendWithRetry(String recipientEmail, String title, String body) {
        EmailDeliveryResult lastResult = null;
        for (int attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
            lastResult = sendByEmail(recipientEmail, title, body);
            if (lastResult.sent()) {
                return lastResult;
            }
            if (attempt < MAX_RETRY_ATTEMPTS) {
                long delayMs = (long) Math.pow(2, attempt - 1) * 1000;
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return lastResult;
                }
            }
        }
        return lastResult;
    }

    private void updateDeliveryRecord(UUID deliveryId, EmailDeliveryResult result) {
        try {
            transactionTemplate.executeWithoutResult(status -> {
                NotificationDelivery delivery = deliveryRepository.findById(deliveryId).orElse(null);
                if (delivery == null) {
                    return;
                }
                if (result != null && result.sent()) {
                    delivery.setDeliveryStage(NotificationDeliveryStage.PROVIDER_SENT);
                    delivery.setProviderStatus(NotificationProviderStatus.SENT);
                    delivery.setProviderMessageId(result.providerMessageId());
                    delivery.setProviderSentAt(clock.instant());
                } else {
                    delivery.setDeliveryStage(NotificationDeliveryStage.PROVIDER_FAILED);
                    delivery.setProviderStatus(NotificationProviderStatus.FAILED);
                    delivery.setProviderError(result != null ? result.error() : "unknown");
                    delivery.setProviderFailedAt(clock.instant());
                }
                deliveryRepository.save(delivery);
            });
        } catch (Exception e) {
            log.warn("Failed to update delivery record {}: {}", deliveryId, e.getMessage(), e);
        }
    }

    public EmailDeliveryResult sendByEmail(String recipientEmail, String title, String body) {
        if (!enabled) {
            return EmailDeliveryResult.failed("Email provider is not configured.");
        }
        String fromAddress = trimToNull(from);
        if (fromAddress == null) {
            return EmailDeliveryResult.failed("MERHOUSE_EMAIL_FROM is required when email delivery is enabled.");
        }
        String safeRecipient = trimToNull(recipientEmail);
        if (safeRecipient == null) {
            return EmailDeliveryResult.failed("Recipient email is required for email delivery.");
        }
        String subject = trimToNull(title);
        if (subject == null) {
            return EmailDeliveryResult.failed("Email subject is required for email delivery.");
        }
        if (body == null || body.isBlank()) {
            return EmailDeliveryResult.failed("Email body is required for email delivery.");
        }

        return switch (provider) {
            case "log" -> sendToConsole(fromAddress, safeRecipient, subject, body);
            case "resend" -> sendViaResend(fromAddress, safeRecipient, subject, body);
            default -> sendViaSmtp(fromAddress, safeRecipient, subject, body);
        };
    }

    public EmailDeliveryResult send(NotificationDelivery delivery, String body) {
        if (delivery == null || delivery.getRecipient() == null) {
            return EmailDeliveryResult.failed("Recipient email is required for email delivery.");
        }
        return sendByEmail(delivery.getRecipient().getEmail(), delivery.getTitle(), body);
    }

    private EmailDeliveryResult sendToConsole(String fromAddress, String recipientEmail, String subject, String body) {
        log.info("========== EMAIL (console capture mode) ==========");
        log.info("From: {}", fromAddress);
        log.info("To: {}", recipientEmail);
        log.info("Subject: {}", subject);
        log.info("Body:\n{}", body);
        log.info("==================================================");
        return EmailDeliveryResult.sent("console-capture");
    }

    private EmailDeliveryResult sendViaSmtp(String fromAddress, String recipientEmail, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            String replyToAddress = trimToNull(replyTo);
            if (replyToAddress != null) {
                message.setReplyTo(replyToAddress);
            }
            message.setTo(recipientEmail);
            message.setSubject(subject);
            message.setText(body);
            message.setSentDate(java.util.Date.from(Instant.now(clock)));
            mailSender.send(message);
            return EmailDeliveryResult.sent("smtp-accepted");
        } catch (RuntimeException exception) {
            String detail = exception.getMessage();
            log.warn("SMTP delivery failed: {}", detail != null ? detail : exception.getClass().getSimpleName(), exception);
            return EmailDeliveryResult.failed(detail != null ? detail : exception.getClass().getSimpleName());
        }
    }

    @SuppressWarnings("unchecked")
    private EmailDeliveryResult sendViaResend(String fromAddress, String recipientEmail, String subject, String body) {
        try {
            Map<String, Object> payload = Map.of(
                "from", fromAddress,
                "to", List.of(recipientEmail),
                "subject", subject,
                "html", body
            );
            Map<String, Object> response = resendClient.post()
                .uri("/emails")
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(Map.class);
            String messageId = response != null ? (String) response.get("id") : null;
            return EmailDeliveryResult.sent(messageId != null ? messageId : "resend-accepted");
        } catch (RuntimeException exception) {
            String detail = exception.getMessage();
            log.warn("Resend delivery failed: {}", detail != null ? detail : exception.getClass().getSimpleName(), exception);
            return EmailDeliveryResult.failed(detail != null ? detail : exception.getClass().getSimpleName());
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
