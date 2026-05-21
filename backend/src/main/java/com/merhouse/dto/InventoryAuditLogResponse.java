package com.merhouse.dto;

import com.merhouse.entity.InventoryAuditAction;
import com.merhouse.entity.InventoryAuditLog;
import java.time.Instant;
import java.util.UUID;

public record InventoryAuditLogResponse(
    UUID id,
    UUID warehouseId,
    UUID inventoryItemId,
    InventoryAuditAction action,
    int beforeQuantity,
    int afterQuantity,
    int beforeReservedQuantity,
    int afterReservedQuantity,
    String reasonCode,
    String reasonNote,
    UUID actorUserId,
    Instant occurredAt
) {
    public static InventoryAuditLogResponse from(InventoryAuditLog log) {
        return new InventoryAuditLogResponse(
            log.getId(),
            log.getWarehouse().getId(),
            log.getInventoryItem().getId(),
            log.getAction(),
            log.getBeforeQuantity(),
            log.getAfterQuantity(),
            log.getBeforeReservedQuantity(),
            log.getAfterReservedQuantity(),
            log.getReasonCode(),
            log.getReasonNote(),
            log.getActorUser() == null ? null : log.getActorUser().getId(),
            log.getOccurredAt()
        );
    }
}
