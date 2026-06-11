package com.merhouse.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record CreateOrderRequest(
    @NotNull UUID merchantId,
    @NotBlank String customerAddress,
    @NotEmpty List<@Valid CreateOrderItemRequest> items
) {
    public CreateOrderRequest {
        customerAddress = trim(customerAddress);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
