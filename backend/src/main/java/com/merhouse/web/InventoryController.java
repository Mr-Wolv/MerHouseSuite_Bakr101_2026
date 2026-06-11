package com.merhouse.web;

import com.merhouse.dto.AdjustStockRequest;
import com.merhouse.dto.AddStockRequest;
import com.merhouse.dto.CreateInventoryItemRequest;
import com.merhouse.dto.InventoryAuditLogResponse;
import com.merhouse.dto.RemoveStockRequest;
import com.merhouse.dto.UpdateInventoryItemRequest;
import com.merhouse.dto.InventoryItemResponse;
import com.merhouse.dto.WarehouseInventoryResponse;
import com.merhouse.service.InventoryService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {
    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public InventoryItemResponse createItem(@Valid @RequestBody CreateInventoryItemRequest request) {
        return InventoryItemResponse.from(inventoryService.createItem(request));
    }

    @PatchMapping("/items/{inventoryItemId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public InventoryItemResponse updateItem(
        @PathVariable UUID inventoryItemId,
        @Valid @RequestBody UpdateInventoryItemRequest request
    ) {
        return InventoryItemResponse.from(inventoryService.updateItem(inventoryItemId, request));
    }

    @GetMapping("/items")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT')")
    public List<InventoryItemResponse> listItems(@RequestParam(required = false) UUID merchantId) {
        return inventoryService.findItems(merchantId).stream()
            .map(InventoryItemResponse::from)
            .toList();
    }

    @PostMapping("/stock")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public WarehouseInventoryResponse addStock(@Valid @RequestBody AddStockRequest request) {
        return WarehouseInventoryResponse.from(inventoryService.addStock(request));
    }

    @PostMapping("/stock/remove")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public WarehouseInventoryResponse removeStock(@Valid @RequestBody RemoveStockRequest request) {
        return WarehouseInventoryResponse.from(inventoryService.removeStock(request));
    }

    @PostMapping("/stock/adjust")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public WarehouseInventoryResponse adjustStock(@Valid @RequestBody AdjustStockRequest request) {
        return WarehouseInventoryResponse.from(inventoryService.adjustStock(request));
    }

    @GetMapping("/warehouses/{warehouseId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'WAREHOUSE_OPERATOR')")
    public List<WarehouseInventoryResponse> listWarehouseInventory(@PathVariable UUID warehouseId) {
        return inventoryService.findWarehouseInventory(warehouseId).stream()
            .map(WarehouseInventoryResponse::from)
            .toList();
    }

    @GetMapping("/items/{inventoryItemId}/audit-logs")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<InventoryAuditLogResponse> listAuditLogs(@PathVariable UUID inventoryItemId) {
        return inventoryService.findItemAuditLogs(inventoryItemId).stream()
            .map(InventoryAuditLogResponse::from)
            .toList();
    }
}
