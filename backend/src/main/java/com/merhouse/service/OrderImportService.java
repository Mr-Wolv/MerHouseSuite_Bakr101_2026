package com.merhouse.service;

import com.merhouse.dto.CreateOrderImportRequest;
import com.merhouse.dto.CreateOrderItemRequest;
import com.merhouse.dto.CreateOrderRequest;
import com.merhouse.dto.ImportOrderRowRequest;
import com.merhouse.dto.OrderImportBatchResponse;
import com.merhouse.dto.OrderResponse;
import com.merhouse.entity.CustomerOrder;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.OrderImportBatch;
import com.merhouse.entity.OrderImportBatchStatus;
import com.merhouse.entity.OrderImportMode;
import com.merhouse.entity.OrderImportRow;
import com.merhouse.entity.OrderImportRowStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.CustomerOrderRepository;
import com.merhouse.repository.InventoryItemRepository;
import com.merhouse.repository.OrderImportBatchRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderImportService {
    private final OrderImportBatchRepository batchRepository;
    private final InventoryItemRepository itemRepository;
    private final CustomerOrderRepository orderRepository;
    private final TenantService tenantService;
    private final OrderService orderService;
    private final CurrentUserService currentUserService;

    public OrderImportService(
        OrderImportBatchRepository batchRepository,
        InventoryItemRepository itemRepository,
        CustomerOrderRepository orderRepository,
        TenantService tenantService,
        OrderService orderService,
        CurrentUserService currentUserService
    ) {
        this.batchRepository = batchRepository;
        this.itemRepository = itemRepository;
        this.orderRepository = orderRepository;
        this.tenantService = tenantService;
        this.orderService = orderService;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public OrderImportBatchResponse createImport(CreateOrderImportRequest request) {
        currentUserService.requireAdminOrTenant(request.merchantId());
        Tenant merchant = tenantService.getRequired(request.merchantId());
        List<RowPlan> plans = validateRows(request);
        boolean hasRejected = plans.stream().anyMatch(plan -> plan.failureReason != null);
        boolean allOrNoneFailure = hasRejected && request.mode() == OrderImportMode.ALL_OR_NONE;

        OrderImportBatch batch = new OrderImportBatch();
        batch.setMerchant(merchant);
        batch.setMode(request.mode());
        batch.setSourceLabel(defaultLabel(request.sourceLabel()));
        batch.setUploadedBy(currentUserService.required().getUsername());
        batch.setTotalRows(plans.size());

        int createdRows = 0;
        int rejectedRows = 0;
        for (RowPlan plan : plans) {
            OrderImportRow row = new OrderImportRow();
            row.setRowNumber(plan.rowNumber);
            row.setMerchantOrderReference(plan.request.merchantOrderReference().trim());
            row.setSku(plan.request.sku().trim());
            row.setQuantity(plan.request.quantity());
            row.setCustomerAddress(plan.request.customerAddress().trim());
            row.setCustomerName(trimToNull(plan.request.customerName()));
            row.setCustomerPhone(trimToNull(plan.request.customerPhone()));

            if (allOrNoneFailure || plan.failureReason != null) {
                row.setStatus(OrderImportRowStatus.REJECTED);
                row.setFailureReason(allOrNoneFailure && plan.failureReason == null
                    ? "Rejected because all-or-none import contains invalid rows."
                    : plan.failureReason);
                rejectedRows++;
            } else {
                CustomerOrder order = createOrder(request.merchantId(), plan);
                row.setStatus(OrderImportRowStatus.CREATED);
                row.setCreatedOrder(order);
                createdRows++;
            }
            batch.addRow(row);
        }

        batch.setCreatedRows(createdRows);
        batch.setRejectedRows(rejectedRows);
        if (createdRows == plans.size()) {
            batch.setStatus(OrderImportBatchStatus.COMPLETED);
        } else if (createdRows > 0) {
            batch.setStatus(OrderImportBatchStatus.PARTIAL_ACCEPTED);
        } else {
            batch.setStatus(OrderImportBatchStatus.FAILED);
        }

        return OrderImportBatchResponse.from(batchRepository.saveAndFlush(batch));
    }

    @Transactional(readOnly = true)
    public List<OrderImportBatchResponse> findImports(UUID merchantId) {
        UUID effectiveMerchantId = merchantId;
        if (!currentUserService.isAdmin()) {
            effectiveMerchantId = currentUserService.required().tenantId();
            if (merchantId != null && !merchantId.equals(effectiveMerchantId)) {
                currentUserService.requireAdminOrTenant(merchantId);
            }
        }
        if (effectiveMerchantId == null) {
            throw new DomainConflictException("Order import history requires merchantId.");
        }
        return batchRepository.findByMerchantIdOrderByCreatedAtDesc(effectiveMerchantId).stream()
            .map(OrderImportBatchResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public OrderImportBatchResponse getImport(UUID batchId) {
        OrderImportBatch batch = batchRepository.findWithRowsById(batchId)
            .orElseThrow(() -> new ResourceNotFoundException("Order import batch not found: " + batchId));
        if (!currentUserService.hasRole(UserRole.ADMIN)) {
            currentUserService.requireAdminOrTenant(batch.getMerchant().getId());
        }
        return OrderImportBatchResponse.from(batch);
    }

    private List<RowPlan> validateRows(CreateOrderImportRequest request) {
        List<RowPlan> plans = new ArrayList<>();
        Set<String> references = new HashSet<>();
        for (int index = 0; index < request.rows().size(); index++) {
            ImportOrderRowRequest row = request.rows().get(index);
            String failure = null;
            String reference = row.merchantOrderReference().trim().toLowerCase();
            if (!references.add(reference)) {
                failure = "Duplicate merchant order reference in this import batch.";
            }
            InventoryItem item = null;
            if (failure == null) {
                item = itemRepository.findByMerchantIdAndSku(request.merchantId(), row.sku().trim())
                    .orElse(null);
                if (item == null) {
                    failure = "Unknown SKU for this merchant.";
                }
            }
            plans.add(new RowPlan(index + 1, row, item, failure));
        }
        return plans;
    }

    private CustomerOrder createOrder(UUID merchantId, RowPlan plan) {
        OrderResponse response = orderService.create(new CreateOrderRequest(
            merchantId,
            plan.request.customerAddress().trim(),
            List.of(new CreateOrderItemRequest(plan.item.getId(), plan.request.quantity()))
        ));
        return orderRepository.findById(response.id())
            .orElseThrow(() -> new ResourceNotFoundException("Created order not found: " + response.id()));
    }

    private String defaultLabel(String value) {
        return value == null || value.isBlank() ? "Manual import" : value.trim();
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record RowPlan(int rowNumber, ImportOrderRowRequest request, InventoryItem item, String failureReason) {
    }
}
