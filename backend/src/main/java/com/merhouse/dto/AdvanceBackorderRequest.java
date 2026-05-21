package com.merhouse.dto;

import com.merhouse.entity.BackorderStatus;
import jakarta.validation.constraints.NotNull;

public record AdvanceBackorderRequest(@NotNull BackorderStatus nextStatus) {
}
