package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;

public record UpdateInventoryItemRequest(
    @NotBlank @Size(max = 120) String sku,
    @NotBlank @Size(max = 200) String name,
    Map<String, Object> attributes,
    boolean archived
) {
    public UpdateInventoryItemRequest {
        sku = trim(sku);
        name = trim(name);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
