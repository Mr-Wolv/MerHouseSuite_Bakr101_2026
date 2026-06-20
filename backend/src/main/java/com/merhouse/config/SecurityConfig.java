package com.merhouse.config;

import com.merhouse.security.FirebaseTokenFilter;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final FirebaseTokenFilter firebaseTokenFilter;

    @Value("${merhouse.firebase.app-check.enabled:false}")
    private boolean appCheckEnabled;

    private static final String APP_CHECK_HEADER = "X-Firebase-AppCheck";

    public SecurityConfig(FirebaseTokenFilter firebaseTokenFilter) {
        this.firebaseTokenFilter = firebaseTokenFilter;
    }

    @Bean
    SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        CorsConfigurationSource corsConfigurationSource)
        throws Exception {
        var builder = http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(requests -> requests
                .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs", "/v3/api-docs/**", "/v3/api-docs.yaml").permitAll()
                .requestMatchers("/api/v1/health", "/api/v1/health/**").permitAll()
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers("/api/v1/auth/login").permitAll()
                .requestMatchers("/api/v1/auth/password-reset/**").permitAll()
                .requestMatchers("/api/v1/auth/recovery/**").permitAll()
                .requestMatchers("/api/v1/access-requests").permitAll()
                .anyRequest().authenticated()
            )
            // FirebaseTokenFilter is the only authentication filter — it verifies
            // Firebase ID tokens from the Authorization: Bearer header using the
            // Firebase Admin SDK. Custom JWT authentication has been removed.
            .addFilterBefore(firebaseTokenFilter, UsernamePasswordAuthenticationFilter.class);

        // When App Check is enabled, add a request validation that checks
        // the X-Firebase-AppCheck header is present on all requests.
        if (appCheckEnabled) {
            builder = builder.addFilterBefore(
                (request, response, chain) -> {
                    var httpRequest = (jakarta.servlet.http.HttpServletRequest) request;
                    var httpResponse = (jakarta.servlet.http.HttpServletResponse) response;
                    String path = httpRequest.getRequestURI();
                    // Skip App Check for public endpoints
                    if (path.startsWith("/api/v1/health")
                        || path.startsWith("/actuator/health")
                        || path.startsWith("/swagger-ui")
                        || path.startsWith("/v3/api-docs")) {
                        chain.doFilter(request, response);
                        return;
                    }
                    String appCheckToken = httpRequest.getHeader(APP_CHECK_HEADER);
                    if (appCheckToken == null || appCheckToken.isBlank()) {
                        httpResponse.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing App Check token.");
                        return;
                    }
                    chain.doFilter(request, response);
                },
                FirebaseTokenFilter.class
            );
        }

        return builder.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
        @Value("${merhouse.cors.allowed-origins:}") String allowedOrigins) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(parseCsv(allowedOrigins));
        configuration.setAllowedMethods(List.of(
            HttpMethod.GET.name(),
            HttpMethod.POST.name(),
            HttpMethod.PUT.name(),
            HttpMethod.PATCH.name(),
            HttpMethod.DELETE.name(),
            HttpMethod.OPTIONS.name()
        ));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Firebase-AppCheck"));
        configuration.setExposedHeaders(List.of("Authorization", "X-Firebase-AppCheck"));
        configuration.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private static List<String> parseCsv(String value) {
        return Arrays.stream(value.split(","))
            .map(String::trim)
            .filter(origin -> !origin.isBlank())
            .toList();
    }
}
