package com.merhouse.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.merhouse.dto.ErrorResponse;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.security.LoginRateLimitExceededException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

class ApiExceptionHandlerTest {
    private ApiExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new ApiExceptionHandler();
    }

    @Test
    void notFoundReturns404() {
        ResponseEntity<ErrorResponse> result = handler.notFound(
            new ResourceNotFoundException("Item not found: 123"));

        assertEquals(HttpStatus.NOT_FOUND, result.getStatusCode());
        assertNotNull(result.getBody());
        assertEquals(404, result.getBody().status());
        assertTrue(result.getBody().details().contains("Item not found: 123"));
    }

    @Test
    void domainConflictReturns409() {
        ResponseEntity<ErrorResponse> result = handler.domainConflict(
            new DomainConflictException("Duplicate key"));

        assertEquals(HttpStatus.CONFLICT, result.getStatusCode());
        assertEquals(409, result.getBody().status());
        assertTrue(result.getBody().details().contains("Duplicate key"));
    }

    @Test
    void dataIntegrityReturns409() {
        ResponseEntity<ErrorResponse> result = handler.dataIntegrity(
            new DataIntegrityViolationException("unique constraint"));

        assertEquals(HttpStatus.CONFLICT, result.getStatusCode());
        assertEquals(409, result.getBody().status());
        assertTrue(result.getBody().details().get(0).contains("conflicts with existing data"));
    }

    @Test
    void optimisticLockReturns409() {
        ResponseEntity<ErrorResponse> result = handler.optimisticLock(
            new ObjectOptimisticLockingFailureException("Entity", 1L));

        assertEquals(HttpStatus.CONFLICT, result.getStatusCode());
        assertTrue(result.getBody().details().get(0).contains("Retry the request"));
    }

    @Test
    void badCredentialsReturns401() {
        ResponseEntity<ErrorResponse> result = handler.badCredentials(
            new BadCredentialsException("Invalid email or password."));

        assertEquals(HttpStatus.UNAUTHORIZED, result.getStatusCode());
        assertEquals(401, result.getBody().status());
        // Always returns generic message regardless of internal message
        assertTrue(result.getBody().details().contains("Invalid email or password."));
    }

    @Test
    void accessDeniedReturns403() {
        ResponseEntity<ErrorResponse> result = handler.accessDenied(
            new AccessDeniedException("Not authorized"));

        assertEquals(HttpStatus.FORBIDDEN, result.getStatusCode());
        assertEquals(403, result.getBody().status());
        assertTrue(result.getBody().details().contains("Not authorized"));
    }

    @Test
    void loginRateLimitedReturns429WithRetryHeader() {
        LoginRateLimitExceededException exception = new LoginRateLimitExceededException(300);
        ResponseEntity<ErrorResponse> result = handler.loginRateLimited(exception);

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, result.getStatusCode());
        assertEquals(429, result.getBody().status());
        assertEquals("300", result.getHeaders().getFirst("Retry-After"));
    }

    @Test
    void loginRateLimitedIncludesMessage() {
        LoginRateLimitExceededException exception = new LoginRateLimitExceededException(600);
        ResponseEntity<ErrorResponse> result = handler.loginRateLimited(exception);

        assertNotNull(result.getBody());
        assertEquals("Too Many Requests", result.getBody().error());
        assertFalse(result.getBody().details().isEmpty());
    }

    @Test
    void errorResponseHasTimestamp() {
        ResponseEntity<ErrorResponse> result = handler.notFound(
            new ResourceNotFoundException("test"));

        assertNotNull(result.getBody().timestamp());
    }

    @Test
    void errorResponseHasCorrectHttpStatus() {
        ResponseEntity<ErrorResponse> result = handler.notFound(
            new ResourceNotFoundException("test"));

        assertEquals("Not Found", result.getBody().error());
    }

    private static void assertFalse(boolean condition) {
        org.junit.jupiter.api.Assertions.assertFalse(condition);
    }
}
