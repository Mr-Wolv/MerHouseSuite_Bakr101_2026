package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateCustomerContactRequest(
    @NotNull UUID merchantId,
    @NotBlank @Size(max = 120) String label,
    @NotBlank @Size(max = 160) String contactName,
    @Size(max = 80) String phone,
    @NotBlank String address
) {
}
