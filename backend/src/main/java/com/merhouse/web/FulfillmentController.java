package com.merhouse.web;

import com.merhouse.dto.AdvanceAllocationRequest;
import com.merhouse.dto.AdvanceShipmentRequest;
import com.merhouse.dto.CreateShipmentRequest;
import com.merhouse.dto.FulfillmentAllocationResponse;
import com.merhouse.dto.FulfillmentExceptionResponse;
import com.merhouse.dto.ReportExceptionRequest;
import com.merhouse.dto.ResolveExceptionRequest;
import com.merhouse.dto.ShipmentPackageResponse;
import com.merhouse.dto.ShipmentResponse;
import com.merhouse.dto.UpdateAllocationWorkloadRequest;
import com.merhouse.service.FulfillmentService;
import com.merhouse.service.IdempotencyService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class FulfillmentController {
    private final FulfillmentService fulfillmentService;
    private final IdempotencyService idempotencyService;

    public FulfillmentController(FulfillmentService fulfillmentService, IdempotencyService idempotencyService) {
        this.fulfillmentService = fulfillmentService;
        this.idempotencyService = idempotencyService;
    }

    @PatchMapping("/fulfillment-allocations/{id}/status")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public FulfillmentAllocationResponse advanceAllocation(
        @PathVariable UUID id,
        @Valid @RequestBody AdvanceAllocationRequest request
    ) {
        return fulfillmentService.advanceAllocation(id, request.nextStatus());
    }

    @GetMapping("/fulfillment-allocations")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'WAREHOUSE_OPERATOR')")
    public List<FulfillmentAllocationResponse> listAllocations(@RequestParam(required = false) UUID warehouseId) {
        return fulfillmentService.findAllocations(warehouseId);
    }

    @PatchMapping("/fulfillment-allocations/{id}/workload")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public FulfillmentAllocationResponse updateWorkload(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateAllocationWorkloadRequest request
    ) {
        return fulfillmentService.updateWorkload(id, request);
    }

    @PostMapping("/shipments")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public ResponseEntity<ShipmentResponse> createShipment(
        @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
        @Valid @RequestBody CreateShipmentRequest request
    ) {
        return idempotencyService.execute(
            idempotencyKey,
            "POST",
            "/api/v1/shipments",
            request,
            ShipmentResponse.class,
            HttpStatus.CREATED,
            () -> fulfillmentService.createShipment(request)
        );
    }

    @GetMapping("/shipments/{id}/packages")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'WAREHOUSE_OPERATOR')")
    public List<ShipmentPackageResponse> listPackages(@PathVariable UUID id) {
        return fulfillmentService.findPackages(id);
    }

    @PatchMapping("/shipments/{id}/delivered")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public ShipmentResponse markDelivered(@PathVariable UUID id) {
        return fulfillmentService.markDelivered(id);
    }

    @PatchMapping("/shipments/{id}/status")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public ShipmentResponse advanceShipment(@PathVariable UUID id, @Valid @RequestBody AdvanceShipmentRequest request) {
        return fulfillmentService.advanceShipment(id, request.nextStatus());
    }

    @GetMapping("/fulfillment-exceptions")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<FulfillmentExceptionResponse> listExceptions() {
        return fulfillmentService.findExceptions();
    }

    @PostMapping("/fulfillment-exceptions")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public FulfillmentExceptionResponse reportException(@Valid @RequestBody ReportExceptionRequest request) {
        return fulfillmentService.reportException(request);
    }

    @PatchMapping("/fulfillment-exceptions/{id}/resolve")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public FulfillmentExceptionResponse resolveException(
        @PathVariable UUID id,
        @Valid @RequestBody ResolveExceptionRequest request
    ) {
        return fulfillmentService.resolveException(id, request);
    }
}
