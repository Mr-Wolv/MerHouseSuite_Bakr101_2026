package com.merhouse.config;

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
        @Value("${merhouse.swagger.enabled:false}") boolean swaggerEnabled
    ) {
        return arguments -> validate(
            publicDeployment,
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
            swaggerEnabled,
            swaggerEnabled
        );
    }

    static void validate(
        boolean publicDeployment,
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
        boolean swaggerUiEnabled
    ) {
        if (!publicDeployment) {
            return;
        }

        List<String> failures = new ArrayList<>();
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

        if (!failures.isEmpty()) {
            throw new IllegalStateException("Public deployment refused: " + String.join(" ", failures));
        }
    }

    @Bean
    ApplicationRunner publicDeploymentPostgresCheck(
        @Value("${merhouse.deployment.public:false}") boolean publicDeployment,
        @Value("${spring.datasource.password:}") String databasePassword
    ) {
        return arguments -> {
            if (!publicDeployment) {
                return;
            }
            log.info("Production deployment confirmed with database configured.");
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

}
