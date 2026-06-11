package com.merhouse.web;

import com.merhouse.dto.AdminActionRequest;
import com.merhouse.dto.CreateInboundStockRequest;
import com.merhouse.dto.CreateMerchantWarehouseRelationshipRequest;
import com.merhouse.dto.InboundStockRequestResponse;
import com.merhouse.dto.MerchantAuthorizedStockResponse;
import com.merhouse.dto.MerchantWarehouseRelationshipResponse;
import com.merhouse.dto.ReceiveInboundStockRequest;
import com.merhouse.dto.RejectInboundStockRequest;
import com.merhouse.dto.WarehouseProviderOptionResponse;
import com.merhouse.service.MerchantWarehouseService;
import com.merhouse.service.AdminAuditService;
import com.merhouse.service.CurrentUserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/merchant-warehouse")
public class MerchantWarehouseController {
    private final MerchantWarehouseService merchantWarehouseService;
    private final CurrentUserService currentUserService;
    private final AdminAuditService adminAuditService;

    public MerchantWarehouseController(
        MerchantWarehouseService merchantWarehouseService,
        CurrentUserService currentUserService,
        AdminAuditService adminAuditService
    ) {
        this.merchantWarehouseService = merchantWarehouseService;
        this.currentUserService = currentUserService;
        this.adminAuditService = adminAuditService;
    }

    @GetMapping("/warehouse-options")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<WarehouseProviderOptionResponse> listWarehouseProviderOptions() {
        return merchantWarehouseService.findWarehouseProviderOptions();
    }

    @PostMapping("/relationships")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public MerchantWarehouseRelationshipResponse requestRelationship(
        @Valid @RequestBody CreateMerchantWarehouseRelationshipRequest request
    ) {
        return merchantWarehouseService.requestRelationship(request);
    }

    @GetMapping("/relationships")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<MerchantWarehouseRelationshipResponse> listRelationships() {
        return merchantWarehouseService.findRelationships();
    }

    @GetMapping("/authorized-stock")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT')")
    public List<MerchantAuthorizedStockResponse> listAuthorizedStock(@RequestParam(required = false) UUID merchantId) {
        return merchantWarehouseService.findAuthorizedStock(merchantId);
    }

    @PatchMapping("/relationships/{relationshipId}/activate")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public MerchantWarehouseRelationshipResponse activateRelationship(@PathVariable UUID relationshipId) {
        return merchantWarehouseService.activateRelationship(relationshipId);
    }

    @PatchMapping("/relationships/{relationshipId}/suspend")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public MerchantWarehouseRelationshipResponse suspendRelationship(
        @PathVariable UUID relationshipId,
        @Valid @RequestBody AdminActionRequest request
    ) {
        MerchantWarehouseRelationshipResponse response =
            merchantWarehouseService.suspendRelationship(relationshipId, request.reason());
        adminAuditService.record(
            currentUserService.required().id(),
            "RELATIONSHIP_SUSPENDED",
            "MerchantWarehouseRelationship",
            relationshipId,
            request.reason()
        );
        return response;
    }

    @PatchMapping("/relationships/{relationshipId}/reactivate")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public MerchantWarehouseRelationshipResponse reactivateRelationship(
        @PathVariable UUID relationshipId,
        @Valid @RequestBody AdminActionRequest request
    ) {
        MerchantWarehouseRelationshipResponse response =
            merchantWarehouseService.reactivateRelationship(relationshipId, request.reason());
        adminAuditService.record(
            currentUserService.required().id(),
            "RELATIONSHIP_REACTIVATED",
            "MerchantWarehouseRelationship",
            relationshipId,
            request.reason()
        );
        return response;
    }

    @PatchMapping("/relationships/{relationshipId}/end")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public MerchantWarehouseRelationshipResponse endRelationship(
        @PathVariable UUID relationshipId,
        @Valid @RequestBody AdminActionRequest request
    ) {
        MerchantWarehouseRelationshipResponse response =
            merchantWarehouseService.endRelationship(relationshipId, request.reason());
        adminAuditService.record(
            currentUserService.required().id(),
            "RELATIONSHIP_ENDED",
            "MerchantWarehouseRelationship",
            relationshipId,
            request.reason()
        );
        return response;
    }

    @PostMapping("/inbound-stock-requests")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public InboundStockRequestResponse submitInboundStock(@Valid @RequestBody CreateInboundStockRequest request) {
        return merchantWarehouseService.submitInboundStock(request);
    }

    @PostMapping("/inbound-stock-requests/drafts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public InboundStockRequestResponse createInboundDraft(@Valid @RequestBody CreateInboundStockRequest request) {
        return merchantWarehouseService.createInboundDraft(request);
    }

    @GetMapping("/inbound-stock-requests")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<InboundStockRequestResponse> listInboundStockRequests() {
        return merchantWarehouseService.findInboundStockRequests();
    }

    @PatchMapping("/inbound-stock-requests/{inboundStockRequestId}/submit")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public InboundStockRequestResponse submitInboundDraft(@PathVariable UUID inboundStockRequestId) {
        return merchantWarehouseService.submitInboundDraft(inboundStockRequestId);
    }

    @PatchMapping("/inbound-stock-requests/{inboundStockRequestId}/approve")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public InboundStockRequestResponse approveInboundStock(@PathVariable UUID inboundStockRequestId) {
        return merchantWarehouseService.approveInboundStock(inboundStockRequestId);
    }

    @PatchMapping("/inbound-stock-requests/{inboundStockRequestId}/cancel")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public InboundStockRequestResponse cancelInboundStock(@PathVariable UUID inboundStockRequestId) {
        return merchantWarehouseService.cancelInboundStock(inboundStockRequestId);
    }

    @PatchMapping("/inbound-stock-requests/{inboundStockRequestId}/receiving")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public InboundStockRequestResponse startReceiving(@PathVariable UUID inboundStockRequestId) {
        return merchantWarehouseService.startReceiving(inboundStockRequestId);
    }

    @PatchMapping("/inbound-stock-requests/{inboundStockRequestId}/receive")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public InboundStockRequestResponse receiveInboundStock(
        @PathVariable UUID inboundStockRequestId,
        @Valid @RequestBody ReceiveInboundStockRequest request
    ) {
        return merchantWarehouseService.receiveInboundStock(inboundStockRequestId, request);
    }

    @PatchMapping("/inbound-stock-requests/{inboundStockRequestId}/reject")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public InboundStockRequestResponse rejectInboundStock(
        @PathVariable UUID inboundStockRequestId,
        @Valid @RequestBody RejectInboundStockRequest request
    ) {
        return merchantWarehouseService.rejectInboundStock(inboundStockRequestId, request);
    }
}
