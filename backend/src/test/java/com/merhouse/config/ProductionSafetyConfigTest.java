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
            "smtp",
            "",
            "",
            "localhost",
            "",
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
            "smtp",
            "",
            "",
            "localhost",
            "",
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
            "smtp",
            "",
            "",
            "localhost",
            "",
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
            "smtp",
            "",
            "",
            "localhost",
            "",
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
            "smtp",
            "",
            "",
            "localhost",
            "",
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
            "smtp",
            "",
            "",
            "localhost",
            "",
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
            "smtp",
            "ops@merhouse.example",
            "",
            "localhost",
            "ops@merhouse.example",
            "GmailAppCredentialWithStrongPrivateEntropy",
            "deterministic",
            15
        ));
    }

    @Test
    void rejectsPublicEmailDeliveryWithoutSmtpUsername() {
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
            true,
            "smtp",
            "ops@merhouse.example",
            "",
            "smtp.gmail.com",
            "",
            "GmailAppCredentialWithStrongPrivateEntropy",
            "deterministic",
            15
        ));

        assertThat(exception.getMessage()).contains("MERHOUSE_SMTP_USERNAME must be set");
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
            "smtp",
            "ops@merhouse.com",
            "support@merhouse.com",
            "smtp.gmail.com",
            "ops@merhouse.com",
            "GmailAppCredentialWithStrongPrivateEntropy",
            "deterministic",
            15
        ));
    }

    @Test
    void allowsPublicEmailDeliveryWithResendProviderWithoutSmtpCredentials() {
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
            "resend",
            "onboarding@resend.dev",
            "support@merhouse.com",
            "",
            "",
            "",
            "deterministic",
            15
        ));
    }

    @Test
    void rejectsPublicEmailDeliveryWithPlaceholderReplyToAddress() {
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
            true,
            "smtp",
            "ops@merhouse.example",
            "replace-with-support@example.com",
            "smtp.gmail.com",
            "ops@merhouse.com",
            "GmailAppCredentialWithStrongPrivateEntropy",
            "deterministic",
            15
        ));

        assertThat(exception.getMessage()).contains("MERHOUSE_EMAIL_REPLY_TO must be blank or a deployment reply-to email address");
    }

    @Test
    void rejectsPublicDeploymentWithNonHttpsFrontendUrl() {
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
            "http://app.merhouse.com",
            "http://app.merhouse.com",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "smtp",
            "",
            "",
            "localhost",
            "",
            "",
            "deterministic",
            15
        ));

        assertThat(exception.getMessage()).contains("MERHOUSE_PUBLIC_FRONTEND_URL must be an HTTPS deployment origin");
    }

    @Test
    void allowsPublicDeploymentWithNgrokFreeDevFrontendUrl() {
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
            "https://poppied-racheal-subuncinal.ngrok-free.dev",
            "https://poppied-racheal-subuncinal.ngrok-free.dev,capacitor://localhost,ionic://localhost",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "smtp",
            "",
            "",
            "localhost",
            "",
            "",
            "deterministic",
            15
        ));
    }

    @Test
    void rejectsPublicDeploymentWhenCorsOmitsPublicFrontendUrl() {
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
            "https://app.merhouse.com",
            "https://wrong.merhouse.com,capacitor://localhost",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "smtp",
            "",
            "",
            "localhost",
            "",
            "",
            "deterministic",
            15
        ));

        assertThat(exception.getMessage()).contains("MERHOUSE_CORS_ALLOWED_ORIGINS must include MERHOUSE_PUBLIC_FRONTEND_URL");
    }

    @Test
    void rejectsPublicDeploymentWithWildcardCors() {
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
            "https://app.merhouse.com",
            "*",
            "ProdDbCredentialWithStrongPrivateEntropy",
            false,
            false,
            false,
            "smtp",
            "",
            "",
            "localhost",
            "",
            "",
            "deterministic",
            15
        ));

        assertThat(exception.getMessage()).contains("MERHOUSE_CORS_ALLOWED_ORIGINS must list explicit deployment origins");
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
            "smtp",
            "",
            "",
            "localhost",
            "",
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
            "smtp",
            "",
            "",
            "localhost",
            "",
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
            "smtp",
            "",
            "",
            "localhost",
            "",
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
            "smtp",
            "",
            "",
            "localhost",
            "",
            "",
            "deterministic",
            15
        ));
        assertThat(exception.getMessage())
            .contains("MERHOUSE_ACCESS_REQUEST_LIMIT must be between 1 and 20")
            .contains("MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS must be between 1 and 168");
    }
}
