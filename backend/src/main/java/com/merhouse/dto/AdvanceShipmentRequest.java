package com.merhouse.dto;

import com.merhouse.entity.ShipmentStatus;
import jakarta.validation.constraints.NotNull;

public record AdvanceShipmentRequest(@NotNull ShipmentStatus nextStatus) {
}
