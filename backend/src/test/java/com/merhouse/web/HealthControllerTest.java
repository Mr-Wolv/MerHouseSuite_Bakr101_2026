package com.merhouse.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.merhouse.service.SmtpHealthMonitor;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

class HealthControllerTest {
    private static HealthController createController(DataSource dataSource) {
        SmtpHealthMonitor monitor = mock(SmtpHealthMonitor.class);
        return new HealthController(dataSource, monitor);
    }

    @Test
    void healthReturnsUpWhenDatabaseIsAvailable() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(true);

        HealthController controller = createController(dataSource);
        Map<String, String> result = controller.health();

        assertEquals("UP", result.get("status"));
    }

    @Test
    void healthReturnsDownWhenDatabaseIsUnavailable() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(false);

        HealthController controller = createController(dataSource);
        Map<String, String> result = controller.health();

        assertEquals("DOWN", result.get("status"));
    }

    @Test
    void healthReturnsDownWhenConnectionFails() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("Connection refused"));

        HealthController controller = createController(dataSource);
        Map<String, String> result = controller.health();

        assertEquals("DOWN", result.get("status"));
    }

    @Test
    void healthReturnsDownWhenIsValidThrows() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenThrow(new SQLException("Timeout"));

        HealthController controller = createController(dataSource);
        Map<String, String> result = controller.health();

        assertEquals("DOWN", result.get("status"));
    }

    @Test
    void healthAlwaysReturnsSingleStatusKey() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("fail"));

        HealthController controller = createController(dataSource);
        Map<String, String> result = controller.health();

        assertEquals(1, result.size());
        assertEquals("status", result.keySet().iterator().next());
    }
}
