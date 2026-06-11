package com.merhouse.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ImportOrderRowRequest(
    @NotBlank @Size(max = 120) String merchantOrderReference,
    @NotBlank @Size(max = 80) String sku,
    @Min(1) int quantity,
    @NotBlank @Size(max = 240) String customerAddress,
    @Size(max = 160) String customerName,
    @Size(max = 80) String customerPhone
) {
    public ImportOrderRowRequest {
        merchantOrderReference = trim(merchantOrderReference);
        sku = trim(sku);
        customerAddress = trim(customerAddress);
        customerName = trim(customerName);
        customerPhone = trim(customerPhone);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
