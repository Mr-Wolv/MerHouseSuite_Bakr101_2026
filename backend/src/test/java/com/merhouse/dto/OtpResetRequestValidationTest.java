package com.merhouse.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class OtpResetRequestValidationTest {
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            validator = factory.getValidator();
        }
    }

    @Test
    void validRequestPassesValidation() {
        OtpResetRequest request = new OtpResetRequest("user@test.com", "123456", "validpassword");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertTrue(violations.isEmpty(), "Valid request should have no violations: " + violations);
    }

    @Test
    void blankEmailFailsValidation() {
        OtpResetRequest request = new OtpResetRequest("", "123456", "validpassword");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("email")));
    }

    @Test
    void nullEmailFailsValidation() {
        OtpResetRequest request = new OtpResetRequest(null, "123456", "validpassword");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
    }

    @Test
    void invalidEmailFormatFailsValidation() {
        OtpResetRequest request = new OtpResetRequest("not-an-email", "123456", "validpassword");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("email")));
    }

    @Test
    void emailIsTrimmed() {
        OtpResetRequest request = new OtpResetRequest("  user@test.com  ", "123456", "validpassword");
        assertEquals("user@test.com", request.email());
    }

    @Test
    void blankOtpCodeFailsValidation() {
        OtpResetRequest request = new OtpResetRequest("user@test.com", "", "validpassword");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("otpCode")));
    }

    @Test
    void nullOtpCodeFailsValidation() {
        OtpResetRequest request = new OtpResetRequest("user@test.com", null, "validpassword");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
    }

    @Test
    void otpCodeIsTrimmed() {
        OtpResetRequest request = new OtpResetRequest("user@test.com", "  654321  ", "validpassword");
        assertEquals("654321", request.otpCode());
    }

    @Test
    void blankPasswordFailsValidation() {
        OtpResetRequest request = new OtpResetRequest("user@test.com", "123456", "");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("newPassword")));
    }

    @Test
    void nullPasswordFailsValidation() {
        OtpResetRequest request = new OtpResetRequest("user@test.com", "123456", null);
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
    }

    @Test
    void passwordTooShortFailsValidation() {
        OtpResetRequest request = new OtpResetRequest("user@test.com", "123456", "short");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("newPassword")));
    }

    @Test
    void passwordBelowMinimumLengthFailsValidation() {
        // 7 characters, minimum is 8
        OtpResetRequest request = new OtpResetRequest("user@test.com", "123456", "1234567");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
    }

    @Test
    void passwordExactlyMinimumLengthPassesValidation() {
        OtpResetRequest request = new OtpResetRequest("user@test.com", "123456", "12345678");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertTrue(violations.isEmpty(), "8-char password should pass: " + violations);
    }

    @Test
    void passwordExactlyMaximumLengthPassesValidation() {
        String maxLengthPassword = "A".repeat(120);
        OtpResetRequest request = new OtpResetRequest("user@test.com", "123456", maxLengthPassword);
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertTrue(violations.isEmpty(), "120-char password should pass: " + violations);
    }

    @Test
    void passwordOneOverMaximumFailsValidation() {
        String tooLongPassword = "A".repeat(121);
        OtpResetRequest request = new OtpResetRequest("user@test.com", "123456", tooLongPassword);
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("newPassword")));
    }

    @Test
    void passwordFarOverMaximumFailsValidation() {
        String absurdPassword = "A".repeat(500);
        OtpResetRequest request = new OtpResetRequest("user@test.com", "123456", absurdPassword);
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
    }

    @Test
    void passwordNotTrimmedInConstructor() {
        // newPassword is not trimmed by the compact constructor, only email and otpCode are
        OtpResetRequest request = new OtpResetRequest("user@test.com", "123456", "  validpassword  ");
        assertEquals("  validpassword  ", request.newPassword());
    }

    @Test
    void multipleViolationsReportedSimultaneously() {
        OtpResetRequest request = new OtpResetRequest("", "", "");
        Set<ConstraintViolation<OtpResetRequest>> violations = validator.validate(request);
        // Should have violations for email (blank + email format), otpCode (blank), and newPassword (blank + size)
        assertTrue(violations.size() >= 3, "Expected at least 3 violations, got: " + violations.size());
    }
}
