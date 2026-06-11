package com.merhouse.dto;

import com.merhouse.entity.SlaPolicy;

public record SlaPolicyResponse(
    int receivingSlaHours,
    int pickPackSlaHours,
    int shipmentHandoffSlaHours,
    int exceptionResponseSlaHours,
    String pauseRuleNotes
) {
    public static SlaPolicyResponse from(SlaPolicy policy) {
        return new SlaPolicyResponse(
            policy.getReceivingSlaHours(),
            policy.getPickPackSlaHours(),
            policy.getShipmentHandoffSlaHours(),
            policy.getExceptionResponseSlaHours(),
            policy.getPauseRuleNotes()
        );
    }
}
