package com.merhouse.web;

import com.merhouse.dto.AdvanceBackorderRequest;
import com.merhouse.dto.CreateCustomerContactRequest;
import com.merhouse.dto.CreateOrderImportRequest;
import com.merhouse.dto.CreateOrderRequest;
import com.merhouse.dto.CustomerContactResponse;
import com.merhouse.dto.OrderImportBatchResponse;
import com.merhouse.dto.OrderResponse;
import com.merhouse.service.IdempotencyService;
import com.merhouse.service.OrderImportService;
import com.merhouse.service.OrderService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {
    private final OrderService orderService;
    private final OrderImportService orderImportService;
    private final IdempotencyService idempotencyService;

    public OrderController(OrderService orderService, OrderImportService orderImportService, IdempotencyService idempotencyService) {
        this.orderService = orderService;
        this.orderImportService = orderImportService;
        this.idempotencyService = idempotencyService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public ResponseEntity<OrderResponse> create(
        @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
        @Valid @RequestBody CreateOrderRequest request
    ) {
        return idempotencyService.execute(
            idempotencyKey,
            "POST",
            "/api/v1/orders",
            request,
            OrderResponse.class,
            HttpStatus.CREATED,
            () -> orderService.create(request)
        );
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT')")
    public List<OrderResponse> list(@RequestParam(required = false) UUID merchantId) {
        return orderService.findAll(merchantId);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public OrderResponse get(@PathVariable UUID id) {
        return orderService.get(id);
    }

    @PostMapping("/{id}/allocate")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public OrderResponse allocate(@PathVariable UUID id) {
        return orderService.allocate(id);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public OrderResponse cancel(@PathVariable UUID id) {
        return orderService.cancel(id);
    }

    @PatchMapping("/{orderId}/backorders/{backorderId}/status")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public OrderResponse updateBackorder(
        @PathVariable UUID orderId,
        @PathVariable UUID backorderId,
        @Valid @RequestBody AdvanceBackorderRequest request
    ) {
        return orderService.updateBackorder(orderId, backorderId, request.nextStatus());
    }

    @GetMapping("/customer-contacts")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT')")
    public List<CustomerContactResponse> listCustomerContacts(@RequestParam(required = false) UUID merchantId) {
        return orderService.findCustomerContacts(merchantId);
    }

    @PostMapping("/customer-contacts")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public CustomerContactResponse createCustomerContact(@Valid @RequestBody CreateCustomerContactRequest request) {
        return orderService.createCustomerContact(request);
    }

    @PostMapping("/imports")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public OrderImportBatchResponse createImport(@Valid @RequestBody CreateOrderImportRequest request) {
        return orderImportService.createImport(request);
    }

    @GetMapping("/imports")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT')")
    public List<OrderImportBatchResponse> listImports(@RequestParam(required = false) UUID merchantId) {
        return orderImportService.findImports(merchantId);
    }

    @GetMapping("/imports/{batchId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT')")
    public OrderImportBatchResponse getImport(@PathVariable UUID batchId) {
        return orderImportService.getImport(batchId);
    }
}
