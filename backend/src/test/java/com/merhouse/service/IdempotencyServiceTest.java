package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.merhouse.entity.IdempotencyRecord;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.IdempotencyRecordRepository;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class IdempotencyServiceTest {
    private final IdempotencyRecordRepository repository = mock(IdempotencyRecordRepository.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private IdempotencyService service;

    @BeforeEach
    void setUp() {
        service = new IdempotencyService(repository, objectMapper);
    }

    @Test
    void nullKeyExecutesActionDirectly() {
        ResponseEntity<String> result = service.execute(
            null, "POST", "/api/test", Map.of(), String.class, HttpStatus.CREATED, () -> "result");

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals("result", result.getBody());
        verify(repository, never()).findByKey(any());
    }

    @Test
    void blankKeyExecutesActionDirectly() {
        ResponseEntity<String> result = service.execute(
            "   ", "POST", "/api/test", Map.of(), String.class, HttpStatus.CREATED, () -> "result");

        assertEquals("result", result.getBody());
        verify(repository, never()).findByKey(any());
    }

    @Test
    void firstTimeExecutionRunsActionAndSavesRecord() {
        when(repository.findByKey("new-key")).thenReturn(Optional.empty());
        when(repository.save(any(IdempotencyRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        AtomicInteger callCount = new AtomicInteger(0);
        ResponseEntity<Map> result = service.execute(
            "new-key", "POST", "/api/orders", Map.of("item", "widget"),
            Map.class, HttpStatus.CREATED, () -> {
                callCount.incrementAndGet();
                return Map.of("id", "order-1");
            });

        assertEquals(1, callCount.get());
        assertEquals("order-1", result.getBody().get("id"));
        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        verify(repository).save(any(IdempotencyRecord.class));
    }

    @Test
    void repeatSameRequestReturnsCachedResponse() {
        IdempotencyRecord existing = new IdempotencyRecord();
        existing.setKey("repeat-key");
        existing.setMethod("POST");
        existing.setRequestPath("/api/orders");
        existing.setRequestHash(computeHash(Map.of("item", "widget")));
        existing.setResponseStatus(201);
        existing.setResponseBody(Map.of("value", "cached-order"));

        when(repository.findByKey("repeat-key")).thenReturn(Optional.of(existing));

        AtomicInteger callCount = new AtomicInteger(0);
        ResponseEntity<Map> result = service.execute(
            "repeat-key", "POST", "/api/orders", Map.of("item", "widget"),
            Map.class, HttpStatus.CREATED, () -> {
                callCount.incrementAndGet();
                return Map.of("value", "should-not-run");
            });

        assertEquals(0, callCount.get(), "Action must not run for cached idempotent request");
        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals("cached-order", result.getBody().get("value"));
    }

    @Test
    void repeatDifferentRequestThrowsConflict() {
        IdempotencyRecord existing = new IdempotencyRecord();
        existing.setKey("conflict-key");
        existing.setMethod("POST");
        existing.setRequestPath("/api/orders");
        existing.setRequestHash("original-hash-that-does-not-match");
        existing.setResponseStatus(201);
        existing.setResponseBody(Map.of());

        when(repository.findByKey("conflict-key")).thenReturn(Optional.of(existing));

        assertThrows(DomainConflictException.class, () -> service.execute(
            "conflict-key", "POST", "/api/orders", Map.of("different", "payload"),
            String.class, HttpStatus.CREATED, () -> "should-not-run"));
    }

    @Test
    void repeatDifferentMethodThrowsConflict() {
        IdempotencyRecord existing = new IdempotencyRecord();
        existing.setKey("method-key");
        existing.setMethod("POST");
        existing.setRequestPath("/api/orders");
        existing.setRequestHash(computeHash(Map.of("item", "widget")));
        existing.setResponseStatus(201);
        existing.setResponseBody(Map.of());

        when(repository.findByKey("method-key")).thenReturn(Optional.of(existing));

        assertThrows(DomainConflictException.class, () -> service.execute(
            "method-key", "PUT", "/api/orders", Map.of("item", "widget"),
            String.class, HttpStatus.OK, () -> "should-not-run"));
    }

    @Test
    void repeatDifferentPathThrowsConflict() {
        IdempotencyRecord existing = new IdempotencyRecord();
        existing.setKey("path-key");
        existing.setMethod("POST");
        existing.setRequestPath("/api/orders");
        existing.setRequestHash(computeHash(Map.of("item", "widget")));
        existing.setResponseStatus(201);
        existing.setResponseBody(Map.of());

        when(repository.findByKey("path-key")).thenReturn(Optional.of(existing));

        assertThrows(DomainConflictException.class, () -> service.execute(
            "path-key", "POST", "/api/other", Map.of("item", "widget"),
            String.class, HttpStatus.CREATED, () -> "should-not-run"));
    }

    @Test
    void concurrentInsertRecoversFromDataIntegrityViolation() {
        when(repository.findByKey("race-key"))
            .thenReturn(Optional.empty()) // First lookup: not found
            .thenReturn(Optional.of(savedRecord("race-key"))); // Second lookup after conflict

        when(repository.save(any(IdempotencyRecord.class)))
            .thenThrow(new DataIntegrityViolationException("unique constraint violation"));

        ResponseEntity<Map> result = service.execute(
            "race-key", "POST", "/api/orders", Map.of("item", "widget"),
            Map.class, HttpStatus.CREATED, () -> Map.of("value", "from-action"));

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals("concurrent-result", result.getBody().get("value"));
    }

    @Test
    void concurrentInsertWithUnresolvableRecordThrowsConflict() {
        when(repository.findByKey("lost-key"))
            .thenReturn(Optional.empty()) // First lookup
            .thenReturn(Optional.empty()); // Second lookup after conflict (record gone)

        when(repository.save(any(IdempotencyRecord.class)))
            .thenThrow(new DataIntegrityViolationException("constraint"));

        assertThrows(DomainConflictException.class, () -> service.execute(
            "lost-key", "POST", "/api/orders", Map.of("item", "x"),
            Map.class, HttpStatus.CREATED, () -> Map.of("result", "value")));
    }

    @Test
    void actionExceptionPropagatesBeforeSave() {
        when(repository.findByKey("error-key")).thenReturn(Optional.empty());

        RuntimeException error = new RuntimeException("business logic failure");
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> service.execute(
            "error-key", "POST", "/api/test", Map.of("x", 1),
            Map.class, HttpStatus.OK, () -> { throw error; }));

        assertEquals("business logic failure", thrown.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void keyIsTrimmed() {
        // findByKey uses the raw key; trimming only applies when saving the record
        when(repository.findByKey("  trimmed-key  ")).thenReturn(Optional.empty());
        when(repository.save(any(IdempotencyRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        service.execute("  trimmed-key  ", "POST", "/api/test", Map.of("q", 1),
            Map.class, HttpStatus.OK, () -> Map.of("status", "ok"));

        verify(repository).findByKey("  trimmed-key  ");
    }

    @Test
    void savedRecordUsesCorrectResponseStatus() {
        when(repository.findByKey("status-key")).thenReturn(Optional.empty());
        when(repository.save(any(IdempotencyRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<Map> result = service.execute(
            "status-key", "POST", "/api/test", Map.of("a", 1),
            Map.class, HttpStatus.ACCEPTED, () -> Map.of("status", "accepted"));

        assertEquals(HttpStatus.ACCEPTED, result.getStatusCode());
    }

    private IdempotencyRecord savedRecord(String key) {
        IdempotencyRecord record = new IdempotencyRecord();
        record.setKey(key);
        record.setMethod("POST");
        record.setRequestPath("/api/orders");
        record.setRequestHash(computeHash(Map.of("item", "widget")));
        record.setResponseStatus(201);
        record.setResponseBody(Map.of("value", "concurrent-result"));
        return record;
    }

    private String computeHash(Object request) {
        try {
            String json = objectMapper.writeValueAsString(request);
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of().formatHex(digest.digest(json.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
