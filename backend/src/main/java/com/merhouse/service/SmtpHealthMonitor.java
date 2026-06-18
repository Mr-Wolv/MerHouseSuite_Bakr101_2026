package com.merhouse.service;

import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodically checks SMTP provider connectivity and logs the result.
 * Runs once at startup (via fixedDelay = 0) and then every
 * {@code merhouse.smtp.health-check-interval-ms} (default 15 min).
 *
 * Resend provider health check has been removed.
 * This is a read-only diagnostic: it never throws and never blocks the application.
 */
@Component
public class SmtpHealthMonitor {
    private static final Logger log = LoggerFactory.getLogger(SmtpHealthMonitor.class);

    private final JavaMailSender mailSender;
    private final boolean emailEnabled;
    private final String provider;
    private final String smtpHost;
    private final int smtpPort;
    private final String smtpUsername;

    private volatile Map<String, Object> lastCheck = Map.of();

    public SmtpHealthMonitor(
        JavaMailSender mailSender,
        @Value("${merhouse.email.enabled:false}") boolean emailEnabled,
        @Value("${merhouse.email.provider:smtp}") String provider,
        @Value("${spring.mail.host:localhost}") String smtpHost,
        @Value("${spring.mail.port:1025}") int smtpPort,
        @Value("${spring.mail.username:}") String smtpUsername
    ) {
        this.mailSender = mailSender;
        this.emailEnabled = emailEnabled;
        this.provider = provider != null ? provider.trim().toLowerCase() : "smtp";
        this.smtpHost = smtpHost;
        this.smtpPort = smtpPort;
        this.smtpUsername = smtpUsername;
    }

    /**
     * Run initial check immediately, then repeat every 15 minutes.
     */
    @Scheduled(
        initialDelayString = "${merhouse.smtp.health-check-initial-delay-ms:60000}",
        fixedDelayString = "${merhouse.smtp.health-check-interval-ms:900000}"
    )
    public void checkSmtpHealth() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("checkedAt", java.time.Instant.now().toString());
        result.put("emailEnabled", emailEnabled);
        result.put("provider", provider);
        result.put("smtpHost", smtpHost);
        result.put("smtpPort", smtpPort);

        if (!emailEnabled) {
            result.put("status", "SKIPPED");
            result.put("reason", "email is disabled");
            lastCheck = result;
            return;
        }

        if ("log".equals(provider)) {
            result.put("status", "SKIPPED");
            result.put("reason", "email provider is console-capture (log) mode");
            lastCheck = result;
            return;
        }

        checkSmtpHealthDirect(result);
        lastCheck = result;
    }

    private void checkSmtpHealthDirect(Map<String, Object> result) {
        if (smtpHost == null || smtpHost.isBlank()
            || smtpUsername == null || smtpUsername.isBlank()) {
            result.put("status", "SKIPPED");
            result.put("reason", "SMTP not configured");
            return;
        }

        try {
            SimpleMailMessage testMessage = new SimpleMailMessage();
            String sender = smtpUsername;
            testMessage.setFrom(sender);
            testMessage.setTo(sender);
            testMessage.setSubject("MerHouse SMTP periodic health check");
            testMessage.setText("Automated periodic SMTP health check from MerHouse at " + result.get("checkedAt"));
            mailSender.send(testMessage);
            result.put("status", "UP");
            log.info("SMTP periodic health check passed for {}:{}", smtpHost, smtpPort);
        } catch (Exception ex) {
            String detail = ex.getMessage();
            result.put("status", "DOWN");
            result.put("error", detail != null ? detail : ex.getClass().getSimpleName());
            log.warn("SMTP periodic health check failed for {}:{} — {}",
                smtpHost, smtpPort, detail, ex);
        }
    }

    /**
     * Returns the result of the most recent check.
     * Used by the /api/v1/health/smtp endpoint for a lightweight read without re-testing.
     */
    public Map<String, Object> getLastCheckResult() {
        return lastCheck;
    }
}
