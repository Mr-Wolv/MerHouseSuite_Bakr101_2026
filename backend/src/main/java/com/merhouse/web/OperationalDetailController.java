package com.merhouse.web;

import com.merhouse.dto.FulfillmentAllocationDetailResponse;
import com.merhouse.dto.InboundStockRequestDetailResponse;
import com.merhouse.dto.InventoryItemDetailResponse;
import com.merhouse.dto.MerchantWarehouseRelationshipDetailResponse;
import com.merhouse.dto.OrderDetailResponse;
import com.merhouse.dto.ShipmentDetailResponse;
import com.merhouse.service.OperationalDetailService;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operational-details")
public class OperationalDetailController {
    private final OperationalDetailService operationalDetailService;

    public OperationalDetailController(OperationalDetailService operationalDetailService) {
        this.operationalDetailService = operationalDetailService;
    }

    @GetMapping("/orders/{orderId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public OrderDetailResponse orderDetail(@PathVariable UUID orderId) {
        return operationalDetailService.orderDetail(orderId);
    }

    @GetMapping("/inventory-items/{inventoryItemId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT')")
    public InventoryItemDetailResponse inventoryItemDetail(@PathVariable UUID inventoryItemId) {
        return operationalDetailService.inventoryItemDetail(inventoryItemId);
    }

    @GetMapping("/inbound-stock-requests/{inboundStockRequestId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public InboundStockRequestDetailResponse inboundDetail(@PathVariable UUID inboundStockRequestId) {
        return operationalDetailService.inboundDetail(inboundStockRequestId);
    }

    @GetMapping("/shipments/{shipmentId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ShipmentDetailResponse shipmentDetail(@PathVariable UUID shipmentId) {
        return operationalDetailService.shipmentDetail(shipmentId);
    }

    @GetMapping("/fulfillment-allocations/{allocationId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public FulfillmentAllocationDetailResponse allocationDetail(@PathVariable UUID allocationId) {
        return operationalDetailService.allocationDetail(allocationId);
    }

    @GetMapping("/relationships/{relationshipId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public MerchantWarehouseRelationshipDetailResponse relationshipDetail(@PathVariable UUID relationshipId) {
        return operationalDetailService.relationshipDetail(relationshipId);
    }
}
