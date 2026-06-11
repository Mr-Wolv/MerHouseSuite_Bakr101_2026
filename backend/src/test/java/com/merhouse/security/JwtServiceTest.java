package com.merhouse.security;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class JwtServiceTest {
    @Test
    void rejectsShortSecrets() {
        assertThrows(
            IllegalStateException.class,
            () -> new JwtService(new ObjectMapper(), "short-secret", 3600)
        );
    }
}
