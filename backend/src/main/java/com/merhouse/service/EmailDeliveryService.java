package com.merhouse.service;

import com.merhouse.entity.NotificationDelivery;
import java.time.Clock;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailDeliveryService {
    private final JavaMailSender mailSender;
    private final Clock clock;
    private final boolean enabled;
    private final String from;
    private final String replyTo;

    public EmailDeliveryService(
        JavaMailSender mailSender,
        Clock clock,
        @Value("${merhouse.email.enabled:false}") boolean enabled,
        @Value("${merhouse.email.from:}") String from,
        @Value("${merhouse.email.reply-to:}") String replyTo
    ) {
        this.mailSender = mailSender;
        this.clock = clock;
        this.enabled = enabled;
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
