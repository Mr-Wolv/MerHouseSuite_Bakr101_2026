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
import com.merhouse.repository.NotificationDeliveryRepository;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.client.RestClient;

class EmailDeliveryServiceTest {
    private final JavaMailSender mailSender = mock(JavaMailSender.class);
    private final RestClient resendClient = mock(RestClient.class);
    private final NotificationDeliveryRepository deliveryRepository = mock(NotificationDeliveryRepository.class);
    private final TransactionTemplate transactionTemplate = mock(TransactionTemplate.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-06-10T12:00:00Z"), ZoneOffset.UTC);

    @Test
    void disabledProviderFailsWithoutSending() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, false, "smtp", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertFalse(result.sent());
        assertEquals("Email provider is not configured.", result.error());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void enabledProviderRequiresSenderAddress() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "smtp", " ", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertFalse(result.sent());
        assertEquals("MERHOUSE_EMAIL_FROM is required when email delivery is enabled.", result.error());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void configuredProviderBuildsSmtpMessage() {
        EmailDeliveryService service = new EmailDeliveryService(
            mailSender,
            resendClient,
            clock,
            deliveryRepository,
            transactionTemplate,
            true,
            "smtp",
            " ops@merhouse.example ",
            " support@merhouse.example "
        );

        EmailDeliveryResult result = service.send(delivery(" user@merhouse.example ", " Account ready "), "Account body");

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
    void enabledProviderRequiresRecipientEmail() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "smtp", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(" ", "Account ready"), "Body");

        assertFalse(result.sent());
        assertEquals("Recipient email is required for email delivery.", result.error());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void enabledProviderRequiresSubject() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "smtp", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery("user@merhouse.example", " "), "Body");

        assertFalse(result.sent());
        assertEquals("Email subject is required for email delivery.", result.error());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void enabledProviderRequiresBody() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "smtp", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), " ");

        assertFalse(result.sent());
        assertEquals("Email body is required for email delivery.", result.error());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void providerFailureReturnsSanitizedFailureResult() {
        doThrow(new MailSendException("smtp unavailable")).when(mailSender).send(any(SimpleMailMessage.class));
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "smtp", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertFalse(result.sent());
        assertNull(result.providerMessageId());
        assertEquals("smtp unavailable", result.error());
    }

    @Test
    void nonMailExceptionIsCaughtAndReturnsFailure() {
        doThrow(new RuntimeException("connection refused")).when(mailSender).send(any(SimpleMailMessage.class));
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "smtp", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertFalse(result.sent());
        assertNull(result.providerMessageId());
        assertEquals("connection refused", result.error());
    }

    @Test
    void exceptionWithNullMessageReturnsClassName() {
        doThrow(new RuntimeException()).when(mailSender).send(any(SimpleMailMessage.class));
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "smtp", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertFalse(result.sent());
        assertNull(result.providerMessageId());
        assertEquals("RuntimeException", result.error());
    }

    @Test
    void logProviderCapturesEmailInConsole() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "log", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), "Test body content");

        assertTrue(result.sent());
        assertEquals("console-capture", result.providerMessageId());
        assertNull(result.error());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void logProviderValidatesFromAddress() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "log", " ", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertFalse(result.sent());
        assertEquals("MERHOUSE_EMAIL_FROM is required when email delivery is enabled.", result.error());
    }

    @Test
    void logProviderValidatesRecipient() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "log", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(" ", "Subject"), "Body");

        assertFalse(result.sent());
        assertEquals("Recipient email is required for email delivery.", result.error());
    }

    @Test
    void logProviderValidatesSubject() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "log", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery("user@merhouse.example", " "), "Body");

        assertFalse(result.sent());
        assertEquals("Email subject is required for email delivery.", result.error());
    }

    @Test
    void logProviderValidatesBody() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "log", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), " ");

        assertFalse(result.sent());
        assertEquals("Email body is required for email delivery.", result.error());
    }

    @Test
    void defaultProviderIsSmtpWhenNull() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, null, "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertTrue(result.sent());
        assertEquals("smtp-accepted", result.providerMessageId());
    }

    @Test
    void providerIsCaseInsensitive() {
        EmailDeliveryService service = new EmailDeliveryService(mailSender, resendClient, clock, deliveryRepository, transactionTemplate, true, "LOG", "ops@merhouse.example", "");

        EmailDeliveryResult result = service.send(delivery(), "Body");

        assertTrue(result.sent());
        assertEquals("console-capture", result.providerMessageId());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    private NotificationDelivery delivery() {
        return delivery("user@merhouse.example", "Account ready");
    }

    private NotificationDelivery delivery(String email, String title) {
        AppUser recipient = new AppUser();
        recipient.setEmail(email);

        NotificationDelivery delivery = new NotificationDelivery();
        delivery.setRecipient(recipient);
        delivery.setTitle(title);
        return delivery;
    }
}
