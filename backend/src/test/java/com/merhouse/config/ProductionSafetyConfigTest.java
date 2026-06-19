package com.merhouse.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ProductionSafetyConfigTest {
    @Test
    void allowsAnyValuesWhenPublicDeploymentIsDisabled() {
        assertDoesNotThrow(() -> ProductionSafetyConfig.validate(
            false,
            true,
            5,
            60,
            true,
            "replace-with-local-admin-password",
            3,
            24,
            "http://localhost:3000",
            "http://localhost:3000",
            "replace-with-local-postgres-password",
            true,
            true
        ));
    }

    @Test
    void rejectsPublicDeploymentWithPlaceholderDatabasePassword() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            false,
            5,
            60,
            false,
            "",
            3,
            24,
            "https://merhouse.app",
            "https://merhouse.app",
            "replace-with-local-postgres-password",
            false,
            false
        ));
    }

    @Test
    void allowsPublicDeploymentWithPrivateValuesAndSeedAdminDisabled() {
        assertDoesNotThrow(() -> ProductionSafetyConfig.validate(
            true,
            false,
            5,
            60,
            false,
            "",
            3,
            24,
            "https://merhouse.app",
            "https://merhouse.app",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false
        ));
    }

    @Test
    void rejectsPublicDeploymentWithSeedAdminEvenWhenPasswordIsPrivate() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            false,
            5,
            60,
            true,
            "PrivateBootstrapPasswordWithStrongEntropy",
            3,
            24,
            "https://merhouse.app",
            "https://merhouse.app",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false
        ));
    }

    @Test
    void rejectsPublicDeploymentWhenResetTokensOrApiDocsAreExposed() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            true,
            5,
            60,
            false,
            "",
            3,
            24,
            "https://merhouse.app",
            "https://merhouse.app",
            "ProdDbCredentialWithStrongPrivateEntropy",
            true,
            true
        ));
    }

    @Test
    void rejectsPublicDeploymentWithNonHttpsFrontendUrl() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            false,
            5,
            60,
            false,
            "",
            3,
            24,
            "http://merhouse.app",
            "http://merhouse.app",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false
        ));
    }

    @Test
    void rejectsPublicDeploymentWithOutOfRangeRecoveryThrottle() {
        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            false,
            0,
            2,
            false,
            "",
            3,
            24,
            "https://merhouse.app",
            "https://merhouse.app",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false
        ));
        assertThat(exception.getMessage())
            .contains("MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT must be between 1 and 20")
            .contains("MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES must be between 5 and 1440");
    }

    @Test
    void rejectsPublicDeploymentWithOutOfRangeAccessRequestThrottle() {
        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            false,
            5,
            60,
            false,
            "",
            0,
            0,
            "https://merhouse.app",
            "https://merhouse.app",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false
        ));
        assertThat(exception.getMessage())
            .contains("MERHOUSE_ACCESS_REQUEST_LIMIT must be between 1 and 20")
            .contains("MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS must be between 1 and 168");
    }

    @Test
    void rejectsPublicDeploymentWithWildcardCors() {
        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            false,
            5,
            60,
            false,
            "",
            3,
            24,
            "https://merhouse.app",
            "*",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false
        ));
        assertThat(exception.getMessage()).contains("MERHOUSE_CORS_ALLOWED_ORIGINS must list explicit deployment origins");
    }
}
