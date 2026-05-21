package com.merhouse.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record SlaPolicyRequest(
    @Min(1) Integer receivingSlaHours,
    @Min(1) Integer pickPackSlaHours,
    @Min(1) Integer shipmentHandoffSlaHours,
    @Min(1) Integer exceptionResponseSlaHours,
    @Size(max = 500) String pauseRuleNotes
) {
}
