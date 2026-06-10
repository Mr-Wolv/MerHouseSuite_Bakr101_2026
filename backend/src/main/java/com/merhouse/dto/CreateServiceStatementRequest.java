package com.merhouse.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public record CreateServiceStatementRequest(
    @NotNull LocalDate periodStart,
    @NotNull LocalDate periodEnd,
    @NotNull LocalDate dueDate,
    @Size(max = 120) String idempotencyKey,
    @Size(max = 1000) String note,
    @NotEmpty List<@Valid ServiceStatementLineRequest> lines
) {
    public CreateServiceStatementRequest {
        idempotencyKey = trimToNull(idempotencyKey);
        note = trimToNull(note);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static String trimToNull(String value) {
        String trimmed = trim(value);
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }
}
