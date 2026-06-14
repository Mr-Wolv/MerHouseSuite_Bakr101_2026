package com.merhouse.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.merhouse.entity.IdempotencyRecord;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.IdempotencyRecordRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdempotencyService {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final IdempotencyRecordRepository repository;
    private final ObjectMapper objectMapper;

    public IdempotencyService(IdempotencyRecordRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public <T> ResponseEntity<T> execute(
        String key,
        String method,
        String path,
        Object request,
        Class<T> responseType,
        HttpStatus successStatus,
        Supplier<T> action
    ) {
        if (key == null || key.isBlank()) {
            return ResponseEntity.status(successStatus).body(action.get());
        }

        String requestHash = hash(request);
        Optional<IdempotencyRecord> existing = repository.findByKey(key);
        if (existing.isPresent()) {
            IdempotencyRecord record = existing.get();
            if (!record.getRequestHash().equals(requestHash)
                || !record.getMethod().equals(method)
                || !record.getRequestPath().equals(path)) {
                throw new DomainConflictException("Idempotency key was already used for a different request.");
            }
            T response = objectMapper.convertValue(record.getResponseBody(), responseType);
            return ResponseEntity.status(record.getResponseStatus()).body(response);
        }

        T response = action.get();
        IdempotencyRecord record = new IdempotencyRecord();
        record.setKey(key.trim());
        record.setMethod(method);
        record.setRequestPath(path);
        record.setRequestHash(requestHash);
        record.setResponseStatus(successStatus.value());
        record.setResponseBody(objectMapper.convertValue(response, MAP_TYPE));
        try {
            repository.save(record);
        } catch (DataIntegrityViolationException concurrentInsert) {
            // Another request with the same key completed between our check and save.
            // Re-read the record and return its cached response instead of failing.
            return repository.findByKey(key)
                .map(saved -> {
                    T cached = objectMapper.convertValue(saved.getResponseBody(), responseType);
                    return ResponseEntity.status(saved.getResponseStatus()).body(cached);
                })
                .orElseThrow(() -> new DomainConflictException(
                    "Idempotency key conflict could not be resolved."));
        }
        return ResponseEntity.status(successStatus).body(response);
    }

    private String hash(Object request) {
        try {
            String json = objectMapper.writeValueAsString(request);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(json.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash idempotent request.", exception);
        }
    }
}
