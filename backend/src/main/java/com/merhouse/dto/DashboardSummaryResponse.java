package com.merhouse.dto;

import java.util.List;

public record DashboardSummaryResponse(
    long orders,
    long openBackorders,
    long deliveredShipments,
    long inboundOpen,
    long stockRisk,
    long openExceptions,
    List<AttentionSignalResponse> attentionSignals
) {
    public DashboardSummaryResponse(
        long orders,
        long openBackorders,
        long deliveredShipments,
        long inboundOpen,
        long stockRisk,
        long openExceptions
    ) {
        this(orders, openBackorders, deliveredShipments, inboundOpen, stockRisk, openExceptions, List.of());
    }
}
