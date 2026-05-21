package com.merhouse.dto;

public record DashboardSummaryResponse(
    long orders,
    long openBackorders,
    long deliveredShipments,
    long inboundOpen,
    long stockRisk,
    long openExceptions
) {
}
