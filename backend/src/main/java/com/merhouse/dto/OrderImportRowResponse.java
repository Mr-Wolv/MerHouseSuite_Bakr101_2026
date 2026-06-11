package com.merhouse.dto;

import com.merhouse.entity.OrderImportRow;
import com.merhouse.entity.OrderImportRowStatus;
import java.util.UUID;

public record OrderImportRowResponse(
    UUID id,
    int rowNumber,
    OrderImportRowStatus status,
    String merchantOrderReference,
    String sku,
    int quantity,
    String customerAddress,
    String customerName,
    String customerPhone,
    UUID createdOrderId,
    String failureReason
) {
    public static OrderImportRowResponse from(OrderImportRow row) {
        return new OrderImportRowResponse(
            row.getId(),
            row.getRowNumber(),
            row.getStatus(),
            row.getMerchantOrderReference(),
            row.getSku(),
            row.getQuantity(),
            row.getCustomerAddress(),
            row.getCustomerName(),
            row.getCustomerPhone(),
            row.getCreatedOrder() == null ? null : row.getCreatedOrder().getId(),
            row.getFailureReason()
        );
    }
}
