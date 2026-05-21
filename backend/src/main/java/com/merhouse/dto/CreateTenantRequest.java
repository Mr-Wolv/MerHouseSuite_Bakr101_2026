package com.merhouse.dto;

import com.merhouse.entity.TenantType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateTenantRequest(
    @NotBlank @Size(max = 160) String name,
    @NotNull TenantType type
) {
}
