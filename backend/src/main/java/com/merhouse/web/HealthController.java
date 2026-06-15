package com.merhouse.web;

import com.merhouse.service.SmtpHealthMonitor;
import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private static final Logger log = LoggerFactory.getLogger(HealthController.class);
    private final DataSource dataSource;
    private final SmtpHealthMonitor smtpHealthMonitor;

    public HealthController(
        DataSource dataSource,
        SmtpHealthMonitor smtpHealthMonitor
    ) {
        this.dataSource = dataSource;
        this.smtpHealthMonitor = smtpHealthMonitor;
    }

    @GetMapping("/api/v1/health")
    public Map<String, String> health() {
        try (Connection connection = dataSource.getConnection()) {
            boolean valid = connection.isValid(2);
            return Map.of("status", valid ? "UP" : "DOWN");
        } catch (Exception exception) {
            log.warn("Health check failed: {}", exception.getMessage());
            return Map.of("status", "DOWN");
        }
    }

    @GetMapping("/api/v1/health/smtp")
    public Map<String, Object> smtpHealth() {
        Map<String, Object> result = new LinkedHashMap<>(smtpHealthMonitor.getLastCheckResult());
        result.put("endpoint", "/api/v1/health/smtp");
        return result;
    }
}
