package com.merhouse.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

class SecurityConfigTest {
    private final SecurityConfig securityConfig = new SecurityConfig();

    @Test
    void corsConfigurationAllowsLocalWebAndNativeOrigins() {
        CorsConfigurationSource source = securityConfig.corsConfigurationSource(
            "http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173,http://localhost,https://localhost,capacitor://localhost,ionic://localhost"
        );

        assertThat(source).isInstanceOf(UrlBasedCorsConfigurationSource.class);
        CorsConfiguration configuration = ((UrlBasedCorsConfigurationSource) source)
            .getCorsConfigurations()
            .get("/api/**");

        assertThat(configuration).isNotNull();
        assertThat(configuration.getAllowedOrigins()).containsExactly(
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost",
            "https://localhost",
            "capacitor://localhost",
            "ionic://localhost"
        );
        assertThat(configuration.getAllowedMethods()).contains("GET", "POST", "PATCH", "OPTIONS");
        assertThat(configuration.getAllowedHeaders()).containsExactly("Authorization", "Content-Type");
        assertThat(configuration.getAllowCredentials()).isFalse();
    }

    @Test
    void corsConfigurationIgnoresBlankOrigins() {
        CorsConfigurationSource source = securityConfig.corsConfigurationSource(
            " http://localhost ,, capacitor://localhost "
        );

        CorsConfiguration configuration = ((UrlBasedCorsConfigurationSource) source)
            .getCorsConfigurations()
            .get("/api/**");

        assertThat(configuration.getAllowedOrigins()).isEqualTo(List.of("http://localhost", "capacitor://localhost"));
    }
}
