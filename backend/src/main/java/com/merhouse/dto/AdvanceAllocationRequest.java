package com.merhouse.dto;

import com.merhouse.entity.FulfillmentStatus;
import jakarta.validation.constraints.NotNull;

public record AdvanceAllocationRequest(@NotNull FulfillmentStatus nextStatus) {
}
