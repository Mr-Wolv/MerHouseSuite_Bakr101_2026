package com.merhouse.config;

import com.merhouse.security.JwtService;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ProductionSafetyConfig {
    private static final Logger log = LoggerFactory.getLogger(ProductionSafetyConfig.class);

    @Bean
    ApplicationRunner publicDeploymentSafetyCheck(
        @Value("${merhouse.deployment.public:false}") boolean publicDeployment,
        @Value("${merhouse.auth.jwt-secret:}") String jwtSecret,
        @Value("${merhouse.auth.recovery.expose-reset-token:false}") boolean exposeResetToken,
        @Value("${merhouse.auth.recovery.request-limit:5}") int recoveryRequestLimit,
        @Value("${merhouse.auth.recovery.request-window-minutes:60}") int recoveryRequestWindowMinutes,
        @Value("${merhouse.auth.seed-admin.enabled:false}") boolean seedAdminEnabled,
        @Value("${merhouse.auth.seed-admin.password:}") String seedAdminPassword,
        @Value("${merhouse.access-requests.request-limit:3}") int accessRequestLimit,
        @Value("${merhouse.access-requests.request-window-hours:24}") int accessRequestWindowHours,
        @Value("${merhouse.public.frontend-url:}") String publicFrontendUrl,
        @Value("${merhouse.cors.allowed-origins:}") String corsAllowedOrigins,
        @Value("${spring.datasource.password:}") String databasePassword,
        @Value("${springdoc.api-docs.enabled:true}") boolean apiDocsEnabled,
        @Value("${springdoc.swagger-ui.enabled:true}") boolean swaggerUiEnabled,
        @Value("${merhouse.email.enabled:false}") boolean emailEnabled,
        @Value("${merhouse.email.provider:smtp}") String emailProvider,
        @Value("${merhouse.email.from:}") String emailFrom,
        @Value("${merhouse.email.reply-to:}") String emailReplyTo,
        @Value("${spring.mail.host:}") String smtpHost,
        @Value("${spring.mail.username:}") String smtpUsername,
        @Value("${spring.mail.password:}") String smtpPassword,
        @Value("${merhouse.agent.mode:deterministic}") String agentMode,
        @Value("${merhouse.agent.timeout-seconds:15}") int agentTimeoutSeconds
    ) {
        return arguments -> validate(
            publicDeployment,
            jwtSecret,
            exposeResetToken,
            recoveryRequestLimit,
            recoveryRequestWindowMinutes,
            seedAdminEnabled,
            seedAdminPassword,
            accessRequestLimit,
            accessRequestWindowHours,
            publicFrontendUrl,
            corsAllowedOrigins,
            databasePassword,
            apiDocsEnabled,
            swaggerUiEnabled,
            emailEnabled,
            emailProvider,
            emailFrom,
            emailReplyTo,
            smtpHost,
            smtpUsername,
            smtpPassword,
            agentMode,
            agentTimeoutSeconds
        );
    }

    static void validate(
        boolean publicDeployment,
        String jwtSecret,
        boolean exposeResetToken,
        int recoveryRequestLimit,
        int recoveryRequestWindowMinutes,
        boolean seedAdminEnabled,
        String seedAdminPassword,
        int accessRequestLimit,
        int accessRequestWindowHours,
        String databasePassword,
        boolean apiDocsEnabled,
        boolean swaggerUiEnabled,
        boolean emailEnabled,
        String emailProvider,
        String emailFrom,
        String smtpHost,
        String smtpUsername,
        String smtpPassword,
        String agentMode,
        int agentTimeoutSeconds
    ) {
        validate(
            publicDeployment,
            jwtSecret,
            exposeResetToken,
            recoveryRequestLimit,
            recoveryRequestWindowMinutes,
            seedAdminEnabled,
            seedAdminPassword,
            accessRequestLimit,
            accessRequestWindowHours,
            "https://app.merhouse.com",
            "https://app.merhouse.com,capacitor://localhost,ionic://localhost",
            databasePassword,
            apiDocsEnabled,
            swaggerUiEnabled,
            emailEnabled,
            emailProvider,
            emailFrom,
            "",
            smtpHost,
            smtpUsername,
            smtpPassword,
            agentMode,
            agentTimeoutSeconds
        );
    }

    static void validate(
        boolean publicDeployment,
        String jwtSecret,
        boolean exposeResetToken,
        int recoveryRequestLimit,
        int recoveryRequestWindowMinutes,
        boolean seedAdminEnabled,
        String seedAdminPassword,
        int accessRequestLimit,
        int accessRequestWindowHours,
        String databasePassword,
        boolean apiDocsEnabled,
        boolean swaggerUiEnabled,
        boolean emailEnabled,
        String emailProvider,
        String emailFrom,
        String emailReplyTo,
        String smtpHost,
        String smtpUsername,
        String smtpPassword,
        String agentMode,
        int agentTimeoutSeconds
    ) {
        validate(
            publicDeployment,
            jwtSecret,
            exposeResetToken,
            recoveryRequestLimit,
            recoveryRequestWindowMinutes,
            seedAdminEnabled,
            seedAdminPassword,
            accessRequestLimit,
            accessRequestWindowHours,
            "https://app.merhouse.com",
            "https://app.merhouse.com,capacitor://localhost,ionic://localhost",
            databasePassword,
            apiDocsEnabled,
            swaggerUiEnabled,
            emailEnabled,
            emailProvider,
            emailFrom,
            emailReplyTo,
            smtpHost,
            smtpUsername,
            smtpPassword,
            agentMode,
            agentTimeoutSeconds
        );
    }

    static void validate(
        boolean publicDeployment,
        String jwtSecret,
        boolean exposeResetToken,
        int recoveryRequestLimit,
        int recoveryRequestWindowMinutes,
        boolean seedAdminEnabled,
        String seedAdminPassword,
        int accessRequestLimit,
        int accessRequestWindowHours,
        String publicFrontendUrl,
        String corsAllowedOrigins,
        String databasePassword,
        boolean apiDocsEnabled,
        boolean swaggerUiEnabled,
        boolean emailEnabled,
        String emailProvider,
        String emailFrom,
        String smtpHost,
        String smtpUsername,
        String smtpPassword,
        String agentMode,
        int agentTimeoutSeconds
    ) {
        validate(
            publicDeployment,
            jwtSecret,
            exposeResetToken,
            recoveryRequestLimit,
            recoveryRequestWindowMinutes,
            seedAdminEnabled,
            seedAdminPassword,
            accessRequestLimit,
            accessRequestWindowHours,
            publicFrontendUrl,
            corsAllowedOrigins,
            databasePassword,
            apiDocsEnabled,
            swaggerUiEnabled,
            emailEnabled,
            emailProvider,
            emailFrom,
            "",
            smtpHost,
            smtpUsername,
            smtpPassword,
            agentMode,
            agentTimeoutSeconds
        );
    }

    static void validate(
        boolean publicDeployment,
        String jwtSecret,
        boolean exposeResetToken,
        int recoveryRequestLimit,
        int recoveryRequestWindowMinutes,
        boolean seedAdminEnabled,
        String seedAdminPassword,
        int accessRequestLimit,
        int accessRequestWindowHours,
        String publicFrontendUrl,
        String corsAllowedOrigins,
        String databasePassword,
        boolean apiDocsEnabled,
        boolean swaggerUiEnabled,
        boolean emailEnabled,
        String emailProvider,
        String emailFrom,
        String emailReplyTo,
        String smtpHost,
        String smtpUsername,
        String smtpPassword,
        String agentMode,
        int agentTimeoutSeconds
    ) {
        if (!publicDeployment) {
            return;
        }

        List<String> failures = new ArrayList<>();
        if (isBlank(jwtSecret) || looksLikePlaceholder(jwtSecret)) {
            failures.add("MERHOUSE_AUTH_JWT_SECRET must be set to a private production value.");
        }
        if (!isBlank(jwtSecret) && jwtSecret.getBytes(StandardCharsets.UTF_8).length < JwtService.MIN_SECRET_BYTES) {
            failures.add("MERHOUSE_AUTH_JWT_SECRET must be at least 32 bytes.");
        }
        if (isBlank(databasePassword) || looksLikePlaceholder(databasePassword)) {
            failures.add("MERHOUSE_POSTGRES_PASSWORD/SPRING_DATASOURCE_PASSWORD must be set to a private production value.");
        }
        if (seedAdminEnabled) {
            failures.add("MERHOUSE_AUTH_SEED_ADMIN_ENABLED must be false for public deployments.");
            if (isBlank(seedAdminPassword) || looksLikePlaceholder(seedAdminPassword)) {
                failures.add("MERHOUSE_AUTH_SEED_ADMIN_PASSWORD must not be a placeholder when local seeding is used.");
            }
        }
        if (exposeResetToken) {
            failures.add("MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN must be false for public deployments.");
        }
        if (recoveryRequestLimit < 1 || recoveryRequestLimit > 20) {
            failures.add("MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT must be between 1 and 20.");
        }
        if (recoveryRequestWindowMinutes < 5 || recoveryRequestWindowMinutes > 1440) {
            failures.add("MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES must be between 5 and 1440.");
        }
        if (accessRequestLimit < 1 || accessRequestLimit > 20) {
            failures.add("MERHOUSE_ACCESS_REQUEST_LIMIT must be between 1 and 20.");
        }
        if (accessRequestWindowHours < 1 || accessRequestWindowHours > 168) {
            failures.add("MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS must be between 1 and 168.");
        }
        String normalizedFrontendUrl = stripTrailingSlash(normalize(publicFrontendUrl));
        if (isBlank(normalizedFrontendUrl) || !normalizedFrontendUrl.startsWith("https://") || looksLikePlaceholderOrigin(normalizedFrontendUrl)) {
            failures.add("MERHOUSE_PUBLIC_FRONTEND_URL must be an HTTPS deployment origin, not a placeholder.");
        }
        List<String> normalizedCorsOrigins = normalizeCsvOrigins(corsAllowedOrigins);
        if (normalizedCorsOrigins.isEmpty() || normalizedCorsOrigins.contains("*")) {
            failures.add("MERHOUSE_CORS_ALLOWED_ORIGINS must list explicit deployment origins; wildcard CORS is not allowed for public deployments.");
        } else if (!isBlank(normalizedFrontendUrl) && !normalizedCorsOrigins.contains(normalizedFrontendUrl)) {
            failures.add("MERHOUSE_CORS_ALLOWED_ORIGINS must include MERHOUSE_PUBLIC_FRONTEND_URL for public deployments.");
        }
        if (apiDocsEnabled || swaggerUiEnabled) {
            failures.add("MERHOUSE_SWAGGER_ENABLED/springdoc API docs and Swagger UI must be disabled for public deployments.");
        }
        if (emailEnabled) {
            boolean usingSmtp = "smtp".equalsIgnoreCase(emailProvider);
            if (isBlank(emailFrom)) {
                failures.add("MERHOUSE_EMAIL_FROM must be set when email delivery is enabled for public deployments.");
            } else if (!isEmailLike(emailFrom) || looksLikePlaceholder(emailFrom)) {
                failures.add("MERHOUSE_EMAIL_FROM must be a deployment sender email address, not a placeholder.");
            }
            if (!isBlank(emailReplyTo) && (!isEmailLike(emailReplyTo) || looksLikePlaceholder(emailReplyTo))) {
                failures.add("MERHOUSE_EMAIL_REPLY_TO must be blank or a deployment reply-to email address, not a placeholder.");
            }
            if (usingSmtp) {
                if (isBlank(smtpHost) || smtpHost.equalsIgnoreCase("localhost") || smtpHost.equals("127.0.0.1")) {
                    failures.add("MERHOUSE_SMTP_HOST must point to an external provider when email delivery is enabled for public deployments.");
                }
                if (isBlank(smtpUsername) || looksLikePlaceholder(smtpUsername)) {
                    failures.add("MERHOUSE_SMTP_USERNAME must be set to a private provider account when email delivery is enabled for public deployments.");
                }
                if (isBlank(smtpPassword) || looksLikePlaceholder(smtpPassword)) {
                    failures.add("MERHOUSE_SMTP_PASSWORD must be set to a private provider credential when email delivery is enabled for public deployments.");
                }
            }
        }
        if (!"deterministic".equalsIgnoreCase(normalize(agentMode))) {
            failures.add("MERHOUSE_AGENT_MODE must remain deterministic until a provider-backed agent runtime is implemented and proven.");
        }
        if (agentTimeoutSeconds < 1 || agentTimeoutSeconds > 60) {
            failures.add("MERHOUSE_AGENT_TIMEOUT_SECONDS must be between 1 and 60.");
        }

        if (!failures.isEmpty()) {
            throw new IllegalStateException("Public deployment refused: " + String.join(" ", failures));
        }
    }

    @Bean
    ApplicationRunner emailProviderCheck(
        @Value("${merhouse.email.enabled:false}") boolean emailEnabled,
        @Value("${merhouse.deployment.public:false}") boolean publicDeployment,
        @Value("${merhouse.email.provider:smtp}") String emailProvider,
        @Value("${spring.mail.host:}") String smtpHost,
        @Value("${spring.mail.username:}") String smtpUsername
    ) {
        return arguments -> {
            if (!emailEnabled || !publicDeployment) {
                return;
            }
            if ("smtp".equals(emailProvider)) {
                if (isBlank(smtpHost) || isBlank(smtpUsername)) {
                    log.warn("Email provider is 'smtp' but SMTP host/username not fully configured."
                        + " Email delivery will be attempted but may fail at runtime.");
                } else {
                    log.info("Email provider configured: SMTP ({}). Periodic health check will verify connectivity.", smtpHost);
                }
            } else if ("log".equals(emailProvider)) {
                log.info("Email provider configured: console capture mode.");
            }
        };
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static String stripTrailingSlash(String value) {
        String normalized = normalize(value);
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private static List<String> normalizeCsvOrigins(String value) {
        List<String> origins = new ArrayList<>();
        for (String origin : normalize(value).split(",")) {
            String normalized = stripTrailingSlash(origin);
            if (!normalized.isBlank()) {
                origins.add(normalized);
            }
        }
        return origins;
    }

    private static boolean looksLikePlaceholder(String value) {
        String normalized = value.toLowerCase();
        return normalized.contains("change")
            || normalized.contains("replace")
            || normalized.contains("example")
            || normalized.contains("local")
            || normalized.contains("password");
    }

    private static boolean looksLikePlaceholderOrigin(String value) {
        String normalized = value.toLowerCase();
        return normalized.contains("change")
            || normalized.contains("replace")
            || normalized.contains("example")
            || normalized.contains("invalid")
            || normalized.contains("localhost")
            || normalized.contains("127.0.0.1");
    }

    private static boolean isEmailLike(String value) {
        return value != null && value.trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    }
}
