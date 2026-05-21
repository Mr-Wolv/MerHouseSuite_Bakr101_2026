package com.merhouse.dto;

import com.merhouse.entity.Shipment;
import com.merhouse.entity.ShipmentStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.UUID;

public record ShipmentResponse(
    UUID id,
    UUID allocationId,
    UUID orderId,
    UUID warehouseId,
    String carrier,
    String trackingNumber,
    Integer packageCount,
    BigDecimal packageWeightKg,
    Integer packageLengthCm,
    Integer packageWidthCm,
    Integer packageHeightCm,
    String packingNote,
    ShipmentStatus status,
    List<ShipmentPackageResponse> packages,
    Map<String, Object> metadata,
    Instant createdAt
) {
    public static ShipmentResponse from(Shipment shipment) {
        return new ShipmentResponse(
            shipment.getId(),
            shipment.getAllocation().getId(),
            shipment.getAllocation().getOrder().getId(),
            shipment.getAllocation().getWarehouse().getId(),
            shipment.getCarrier(),
            shipment.getTrackingNumber(),
            integerMetadata(shipment.getMetadata(), "packageCount"),
            decimalMetadata(shipment.getMetadata(), "packageWeightKg"),
            integerMetadata(shipment.getMetadata(), "packageLengthCm"),
            integerMetadata(shipment.getMetadata(), "packageWidthCm"),
            integerMetadata(shipment.getMetadata(), "packageHeightCm"),
            stringMetadata(shipment.getMetadata(), "packingNote"),
            shipment.getStatus(),
            shipment.getPackages().stream().map(ShipmentPackageResponse::from).toList(),
            shipment.getMetadata(),
            shipment.getCreatedAt()
        );
    }

    private static Integer integerMetadata(Map<String, Object> metadata, String key) {
        Object value = metadata == null ? null : metadata.get(key);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            return Integer.valueOf(text);
        }
        return null;
    }

    private static BigDecimal decimalMetadata(Map<String, Object> metadata, String key) {
        Object value = metadata == null ? null : metadata.get(key);
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        if (value instanceof String text && !text.isBlank()) {
            return new BigDecimal(text);
        }
        return null;
    }

    private static String stringMetadata(Map<String, Object> metadata, String key) {
        Object value = metadata == null ? null : metadata.get(key);
        return value == null ? null : value.toString();
    }
}
