package com.merhouse.service;

import com.merhouse.entity.NotificationDelivery;
import java.time.Clock;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(EmailDeliveryService.class);

    private final JavaMailSender mailSender;
    private final Clock clock;
    private final boolean enabled;
    private final String provider;
    private final String from;
    private final String replyTo;

    public EmailDeliveryService(
        JavaMailSender mailSender,
        Clock clock,
        @Value("${merhouse.email.enabled:false}") boolean enabled,
        @Value("${merhouse.email.provider:smtp}") String provider,
        @Value("${merhouse.email.from:}") String from,
        @Value("${merhouse.email.reply-to:}") String replyTo
    ) {
        this.mailSender = mailSender;
        this.clock = clock;
        this.enabled = enabled;
        this.provider = provider != null ? provider.trim().toLowerCase() : "smtp";
        this.from = from;
        this.replyTo = replyTo;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public EmailDeliveryResult send(NotificationDelivery delivery, String body) {
        if (!enabled) {
            return EmailDeliveryResult.failed("Email provider is not configured.");
        }
        String fromAddress = trimToNull(from);
        if (fromAddress == null) {
            return EmailDeliveryResult.failed("MERHOUSE_EMAIL_FROM is required when email delivery is enabled.");
        }
        if (delivery == null || delivery.getRecipient() == null) {
            return EmailDeliveryResult.failed("Recipient email is required for email delivery.");
        }
        String recipientEmail = trimToNull(delivery.getRecipient().getEmail());
        if (recipientEmail == null) {
            return EmailDeliveryResult.failed("Recipient email is required for email delivery.");
        }
        String subject = trimToNull(delivery.getTitle());
        if (subject == null) {
            return EmailDeliveryResult.failed("Email subject is required for email delivery.");
        }
        if (body == null || body.isBlank()) {
            return EmailDeliveryResult.failed("Email body is required for email delivery.");
        }

        if ("log".equals(provider)) {
            return sendToConsole(fromAddress, recipientEmail, subject, body);
        }
        return sendViaSmtp(fromAddress, recipientEmail, subject, body);
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
        } catch (MailException exception) {
            return EmailDeliveryResult.failed(exception.getMessage());
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
