package com.merhouse.dto;

import com.merhouse.entity.ShipmentPackage;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ShipmentPackageResponse(
    UUID id,
    int packageNumber,
    String labelCode,
    BigDecimal weightKg,
    int lengthCm,
    int widthCm,
    int heightCm,
    String status,
    List<ShipmentPackageEventResponse> events,
    Instant createdAt
) {
    public static ShipmentPackageResponse from(ShipmentPackage shipmentPackage) {
        return new ShipmentPackageResponse(
            shipmentPackage.getId(),
            shipmentPackage.getPackageNumber(),
            shipmentPackage.getLabelCode(),
            shipmentPackage.getWeightKg(),
            shipmentPackage.getLengthCm(),
            shipmentPackage.getWidthCm(),
            shipmentPackage.getHeightCm(),
            shipmentPackage.getStatus(),
            shipmentPackage.getEvents().stream().map(ShipmentPackageEventResponse::from).toList(),
            shipmentPackage.getCreatedAt()
        );
    }
}
