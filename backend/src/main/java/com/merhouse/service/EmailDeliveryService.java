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
        if (from == null || from.isBlank()) {
            return EmailDeliveryResult.failed("MERHOUSE_EMAIL_FROM is required when email delivery is enabled.");
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            if (replyTo != null && !replyTo.isBlank()) {
                message.setReplyTo(replyTo);
            }
            message.setTo(delivery.getRecipient().getEmail());
            message.setSubject(delivery.getTitle());
            message.setText(body);
            message.setSentDate(java.util.Date.from(Instant.now(clock)));
            mailSender.send(message);
            return EmailDeliveryResult.sent("smtp-accepted");
        } catch (MailException exception) {
            return EmailDeliveryResult.failed(exception.getMessage());
        }
    }
}
