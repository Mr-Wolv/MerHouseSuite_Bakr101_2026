package com.merhouse.web;

import com.merhouse.dto.ErrorResponse;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.security.LoginRateLimitExceededException;
import java.time.Instant;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> notFound(ResourceNotFoundException exception) {
        return error(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(DomainConflictException.class)
    public ResponseEntity<ErrorResponse> domainConflict(DomainConflictException exception) {
        return error(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> invalidRequest(MethodArgumentNotValidException exception) {
        List<String> details = exception.getBindingResult().getFieldErrors().stream()
            .map(error -> error.getField() + " " + error.getDefaultMessage())
            .toList();
        return ResponseEntity.badRequest()
            .body(new ErrorResponse(Instant.now(), HttpStatus.BAD_REQUEST.value(), "Validation failed", details));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> dataIntegrity(DataIntegrityViolationException exception) {
        return error(HttpStatus.CONFLICT, "Request conflicts with existing data or database constraints.");
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> optimisticLock(ObjectOptimisticLockingFailureException exception) {
        return error(HttpStatus.CONFLICT, "The resource was updated by another transaction. Retry the request.");
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> badCredentials(BadCredentialsException exception) {
        return error(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> accessDenied(AccessDeniedException exception) {
        return error(HttpStatus.FORBIDDEN, exception.getMessage());
    }

    @ExceptionHandler(LoginRateLimitExceededException.class)
    public ResponseEntity<ErrorResponse> loginRateLimited(LoginRateLimitExceededException exception) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .header("Retry-After", String.valueOf(exception.getRetryAfterSeconds()))
            .body(new ErrorResponse(Instant.now(), HttpStatus.TOO_MANY_REQUESTS.value(),
                "Too Many Requests", List.of(exception.getMessage())));
    }

    private ResponseEntity<ErrorResponse> error(HttpStatus status, String detail) {
        return ResponseEntity.status(status)
            .body(new ErrorResponse(Instant.now(), status.value(), status.getReasonPhrase(), List.of(detail)));
    }
}
