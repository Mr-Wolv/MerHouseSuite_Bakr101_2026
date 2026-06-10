package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doThrow;

import com.merhouse.entity.AppUser;
import com.merhouse.entity.NotificationDelivery;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class EmailDeliveryServiceTest {
    private final JavaMailSender mailSender = mock(JavaMailSender.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-06-10T12:00:00Z"), ZoneOffset.UTC);

    @Test
    void disabledProviderFailsWithoutSending() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, clock, false, "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertFalse(result.sent());
        assertEquals("Email provider is not configured.", result.error());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void enabledProviderRequiresSenderAddress() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, clock, true, " ", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertFalse(result.sent());
        assertEquals("MERHOUSE_EMAIL_FROM is required when email delivery is enabled.", result.error());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void configuredProviderBuildsSmtpMessage() {
        EmailDeliveryService service = new EmailDeliveryService(
            mailSender,
            clock,
            true,
            "ops@merhouse.example",
            "support@merhouse.example"
        );

        EmailDeliveryResult result = service.send(delivery(), "Account body");

        assertTrue(result.sent());
        assertEquals("smtp-accepted", result.providerMessageId());
        assertNull(result.error());

        ArgumentCaptor<SimpleMailMessage> messageCaptor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(messageCaptor.capture());
        SimpleMailMessage message = messageCaptor.getValue();
        assertEquals("ops@merhouse.example", message.getFrom());
        assertEquals("support@merhouse.example", message.getReplyTo());
        assertEquals("user@merhouse.example", message.getTo()[0]);
        assertEquals("Account ready", message.getSubject());
        assertEquals("Account body", message.getText());
        assertEquals(Instant.parse("2026-06-10T12:00:00Z"), message.getSentDate().toInstant());
    }

    @Test
    void providerFailureReturnsSanitizedFailureResult() {
        doThrow(new MailSendException("smtp unavailable")).when(mailSender).send(any(SimpleMailMessage.class));
        EmailDeliveryService service = new EmailDeliveryService(mailSender, clock, true, "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertFalse(result.sent());
        assertNull(result.providerMessageId());
        assertEquals("smtp unavailable", result.error());
    }

    private NotificationDelivery delivery() {
        AppUser recipient = new AppUser();
        recipient.setEmail("user@merhouse.example");

        NotificationDelivery delivery = new NotificationDelivery();
        delivery.setRecipient(recipient);
        delivery.setTitle("Account ready");
        return delivery;
    }
}
