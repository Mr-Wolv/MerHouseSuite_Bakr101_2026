package com.merhouse.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ProductionSafetyConfigTest {
    @Test
    void allowsPlaceholderValuesWhenPublicDeploymentIsDisabled() {
        assertDoesNotThrow(() -> ProductionSafetyConfig.validate(
            false,
            "replace-with-local-jwt-secret-at-least-32-characters",
            true,
            5,
            60,
            true,
            "replace-with-local-admin-password",
            3,
            24,
            "replace-with-local-postgres-password",
            true,
            true,
            false,
            "",
            "localhost",
            "",
            "deterministic",
            15
        ));
    }

    @Test
    void rejectsPublicDeploymentWithPlaceholderValues() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "replace-with-local-jwt-secret-at-least-32-characters",
            true,
            5,
            60,
            true,
            "replace-with-local-admin-password",
            3,
            24,
            "replace-with-local-postgres-password",
            true,
            true,
            false,
            "",
            "localhost",
            "",
            "deterministic",
            15
        ));
    }

    @Test
    void rejectsPublicDeploymentWithShortJwtSecret() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "short-secret",
            false,
            5,
            60,
            false,
            "",
            3,
            24,
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "",
            "localhost",
            "",
            "deterministic",
            15
        ));
    }

    @Test
    void allowsPublicDeploymentWithPrivateValuesAndSeedAdminDisabled() {
        assertDoesNotThrow(() -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            false,
            5,
            60,
            false,
            "",
            3,
            24,
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "",
            "localhost",
            "",
            "deterministic",
            15
        ));
    }

    @Test
    void rejectsPublicDeploymentWithSeedAdminEvenWhenPasswordIsPrivate() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            false,
            5,
            60,
            true,
            "PrivateBootstrapPasswordWithStrongEntropy",
            3,
            24,
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "",
            "localhost",
            "",
            "deterministic",
            15
        ));
    }

    @Test
    void rejectsPublicDeploymentWhenResetTokensOrApiDocsAreExposed() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            true,
            5,
            60,
            false,
            "",
            3,
            24,
            "ProdDbCredentialWithStrongPrivateEntropy",
            true,
            true,
            false,
            "",
            "localhost",
            "",
            "deterministic",
            15
        ));
    }

    @Test
    void rejectsPublicEmailDeliveryWithLocalSmtpProvider() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            false,
            5,
            60,
            false,
            "",
            3,
            24,
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            true,
            "ops@merhouse.example",
            "localhost",
            "GmailAppCredentialWithStrongPrivateEntropy",
            "deterministic",
            15
        ));
    }

    @Test
    void allowsPublicEmailDeliveryWithExternalSmtpProvider() {
        assertDoesNotThrow(() -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            false,
            5,
            60,
            false,
            "",
            3,
            24,
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            true,
            "ops@merhouse.example",
            "smtp.gmail.com",
            "GmailAppCredentialWithStrongPrivateEntropy",
            "deterministic",
            15
        ));
    }

    @Test
    void rejectsPublicDeploymentWithUnsupportedAgentMode() {
        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            false,
            5,
            60,
            false,
            "",
            3,
            24,
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "",
            "localhost",
            "",
            "provider",
            15
        ));
        assertThat(exception.getMessage()).contains("MERHOUSE_AGENT_MODE must remain deterministic");
    }

    @Test
    void rejectsPublicDeploymentWithOutOfRangeAgentTimeout() {
        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            false,
            5,
            60,
            false,
            "",
            3,
            24,
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "",
            "localhost",
            "",
            "deterministic",
            0
        ));
        assertThat(exception.getMessage()).contains("MERHOUSE_AGENT_TIMEOUT_SECONDS must be between 1 and 60");
    }

    @Test
    void rejectsPublicDeploymentWithOutOfRangeRecoveryThrottle() {
        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            false,
            0,
            2,
            false,
            "",
            3,
            24,
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "",
            "localhost",
            "",
            "deterministic",
            15
        ));
        assertThat(exception.getMessage())
            .contains("MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT must be between 1 and 20")
            .contains("MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES must be between 5 and 1440");
    }

    @Test
    void rejectsPublicDeploymentWithOutOfRangeAccessRequestThrottle() {
        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            false,
            5,
            60,
            false,
            "",
            0,
            0,
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "",
            "localhost",
            "",
            "deterministic",
            15
        ));
        assertThat(exception.getMessage())
            .contains("MERHOUSE_ACCESS_REQUEST_LIMIT must be between 1 and 20")
            .contains("MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS must be between 1 and 168");
    }
}
