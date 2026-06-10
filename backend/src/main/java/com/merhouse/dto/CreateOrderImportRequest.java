package com.merhouse.dto;

import com.merhouse.entity.OrderImportMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record CreateOrderImportRequest(
    @NotNull UUID merchantId,
    @NotNull OrderImportMode mode,
    @Size(max = 160) String sourceLabel,
    @NotEmpty List<@Valid ImportOrderRowRequest> rows
) {
    public CreateOrderImportRequest {
        sourceLabel = trim(sourceLabel);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
