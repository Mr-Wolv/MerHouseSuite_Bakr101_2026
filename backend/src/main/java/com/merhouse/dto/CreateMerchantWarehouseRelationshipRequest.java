package com.merhouse.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateMerchantWarehouseRelationshipRequest(
    @NotNull UUID merchantId,
    @NotNull UUID warehouseProviderId,
    @Size(max = 1000) String serviceNotes
) {
    public CreateMerchantWarehouseRelationshipRequest {
        serviceNotes = trim(serviceNotes);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
