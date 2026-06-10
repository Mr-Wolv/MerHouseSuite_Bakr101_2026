package com.merhouse.config;

import com.merhouse.security.JwtService;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ProductionSafetyConfig {
    @Bean
    ApplicationRunner publicDeploymentSafetyCheck(
        @Value("${merhouse.deployment.public:false}") boolean publicDeployment,
        @Value("${merhouse.auth.jwt-secret:}") String jwtSecret,
        @Value("${merhouse.auth.recovery.expose-reset-token:false}") boolean exposeResetToken,
        @Value("${merhouse.auth.recovery.request-limit:5}") int recoveryRequestLimit,
        @Value("${merhouse.auth.recovery.request-window-minutes:60}") int recoveryRequestWindowMinutes,
        @Value("${merhouse.auth.seed-admin.enabled:false}") boolean seedAdminEnabled,
        @Value("${merhouse.auth.seed-admin.password:}") String seedAdminPassword,
        @Value("${spring.datasource.password:}") String databasePassword,
        @Value("${springdoc.api-docs.enabled:true}") boolean apiDocsEnabled,
        @Value("${springdoc.swagger-ui.enabled:true}") boolean swaggerUiEnabled,
        @Value("${merhouse.email.enabled:false}") boolean emailEnabled,
        @Value("${merhouse.email.from:}") String emailFrom,
        @Value("${spring.mail.host:}") String smtpHost,
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
            databasePassword,
            apiDocsEnabled,
            swaggerUiEnabled,
            emailEnabled,
            emailFrom,
            smtpHost,
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
        String databasePassword,
        boolean apiDocsEnabled,
        boolean swaggerUiEnabled,
        boolean emailEnabled,
        String emailFrom,
        String smtpHost,
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
        if (apiDocsEnabled || swaggerUiEnabled) {
            failures.add("MERHOUSE_SWAGGER_ENABLED/springdoc API docs and Swagger UI must be disabled for public deployments.");
        }
        if (emailEnabled) {
            if (isBlank(emailFrom)) {
                failures.add("MERHOUSE_EMAIL_FROM must be set when email delivery is enabled for public deployments.");
            }
            if (isBlank(smtpHost) || smtpHost.equalsIgnoreCase("localhost") || smtpHost.equals("127.0.0.1")) {
                failures.add("MERHOUSE_SMTP_HOST must point to an external provider when email delivery is enabled for public deployments.");
            }
            if (isBlank(smtpPassword) || looksLikePlaceholder(smtpPassword)) {
                failures.add("MERHOUSE_SMTP_PASSWORD must be set to a private provider credential when email delivery is enabled for public deployments.");
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

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static boolean looksLikePlaceholder(String value) {
        String normalized = value.toLowerCase();
        return normalized.contains("change")
            || normalized.contains("replace")
            || normalized.contains("example")
            || normalized.contains("local")
            || normalized.contains("dev")
            || normalized.contains("password");
    }
}
