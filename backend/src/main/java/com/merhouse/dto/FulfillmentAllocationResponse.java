package com.merhouse.dto;

import com.merhouse.entity.FulfillmentAllocation;
import com.merhouse.entity.FulfillmentStatus;
import com.merhouse.entity.MerchantWarehouseRelationship;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record FulfillmentAllocationResponse(
    UUID id,
    UUID orderId,
    String customerAddress,
    UUID merchantId,
    String merchantName,
    UUID merchantWarehouseRelationshipId,
    String serviceRelationshipStatus,
    UUID warehouseId,
    String warehouseName,
    FulfillmentStatus status,
    UUID assignedUserId,
    String assignedUserEmail,
    int priority,
    String scanCode,
    Instant pickSheetPrintedAt,
    List<AllocationItemResponse> items,
    ShipmentResponse shipment,
    Instant createdAt
) {
    public static FulfillmentAllocationResponse from(FulfillmentAllocation allocation) {
        return from(allocation, null);
    }

    public static FulfillmentAllocationResponse from(
        FulfillmentAllocation allocation,
        MerchantWarehouseRelationship relationship
    ) {
        return new FulfillmentAllocationResponse(
            allocation.getId(),
            allocation.getOrder().getId(),
            allocation.getOrder().getCustomerAddress(),
            allocation.getOrder().getMerchant().getId(),
            allocation.getOrder().getMerchant().getName(),
            relationship == null ? null : relationship.getId(),
            relationship == null ? null : relationship.getStatus().name(),
            allocation.getWarehouse().getId(),
            allocation.getWarehouse().getName(),
            allocation.getStatus(),
            allocation.getAssignedUser() == null ? null : allocation.getAssignedUser().getId(),
            allocation.getAssignedUser() == null ? null : allocation.getAssignedUser().getEmail(),
            allocation.getPriority(),
            allocation.getScanCode(),
            allocation.getPickSheetPrintedAt(),
            allocation.getItems().stream().map(AllocationItemResponse::from).toList(),
            allocation.getShipment() == null ? null : ShipmentResponse.from(allocation.getShipment()),
            allocation.getCreatedAt()
        );
    }
}
