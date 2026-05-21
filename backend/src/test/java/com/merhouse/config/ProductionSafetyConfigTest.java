package com.merhouse.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class ProductionSafetyConfigTest {
    @Test
    void allowsPlaceholderValuesWhenPublicDeploymentIsDisabled() {
        assertDoesNotThrow(() -> ProductionSafetyConfig.validate(
            false,
            "replace-with-local-jwt-secret-at-least-32-characters",
            true,
            true,
            "replace-with-local-admin-password",
            "replace-with-local-postgres-password",
            true,
            true
        ));
    }

    @Test
    void rejectsPublicDeploymentWithPlaceholderValues() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "replace-with-local-jwt-secret-at-least-32-characters",
            true,
            true,
            "replace-with-local-admin-password",
            "replace-with-local-postgres-password",
            true,
            true
        ));
    }

    @Test
    void rejectsPublicDeploymentWithShortJwtSecret() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "short-secret",
            false,
            false,
            "",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false
        ));
    }

    @Test
    void allowsPublicDeploymentWithPrivateValuesAndSeedAdminDisabled() {
        assertDoesNotThrow(() -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            false,
            false,
            "",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false
        ));
    }

    @Test
    void rejectsPublicDeploymentWithSeedAdminEvenWhenPasswordIsPrivate() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            false,
            true,
            "PrivateBootstrapPasswordWithStrongEntropy",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false
        ));
    }

    @Test
    void rejectsPublicDeploymentWhenResetTokensOrApiDocsAreExposed() {
        assertThrows(IllegalStateException.class, () -> ProductionSafetyConfig.validate(
            true,
            "production-jwt-secret-with-at-least-strong-private-entropy",
            true,
            false,
            "",
            "ProdDbCredentialWithStrongPrivateEntropy",
            true,
            true
        ));
    }
}
