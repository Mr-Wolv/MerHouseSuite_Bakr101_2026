package com.merhouse.dto;

import com.merhouse.entity.OrderImportBatch;
import com.merhouse.entity.OrderImportBatchStatus;
import com.merhouse.entity.OrderImportMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record OrderImportBatchResponse(
    UUID id,
    UUID merchantId,
    OrderImportMode mode,
    OrderImportBatchStatus status,
    String sourceLabel,
    String uploadedBy,
    int totalRows,
    int createdRows,
    int rejectedRows,
    Instant createdAt,
    List<OrderImportRowResponse> rows
) {
    public static OrderImportBatchResponse from(OrderImportBatch batch) {
        return new OrderImportBatchResponse(
            batch.getId(),
            batch.getMerchant().getId(),
            batch.getMode(),
            batch.getStatus(),
            batch.getSourceLabel(),
            batch.getUploadedBy(),
            batch.getTotalRows(),
            batch.getCreatedRows(),
            batch.getRejectedRows(),
            batch.getCreatedAt(),
            batch.getRows().stream()
                .sorted(Comparator.comparingInt(row -> row.getRowNumber()))
                .map(OrderImportRowResponse::from)
                .toList()
        );
    }
}
