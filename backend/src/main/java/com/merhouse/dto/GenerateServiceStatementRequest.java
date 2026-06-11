package com.merhouse.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record GenerateServiceStatementRequest(
    @NotNull LocalDate periodStart,
    @NotNull LocalDate periodEnd,
    @FutureOrPresent @NotNull LocalDate dueDate,
    @Size(max = 120) String idempotencyKey,
    @Size(max = 1000) String note,
    List<UUID> inboundStockRequestIds,
    List<UUID> fulfillmentAllocationIds,
    List<UUID> shipmentIds
) {
    public GenerateServiceStatementRequest {
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
