package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;

public record CreateInventoryItemRequest(
    @NotNull UUID merchantId,
    @NotBlank @Size(max = 120) String sku,
    @NotBlank @Size(max = 200) String name,
    Map<String, Object> attributes
) {
    public CreateInventoryItemRequest {
        sku = trim(sku);
        name = trim(name);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
