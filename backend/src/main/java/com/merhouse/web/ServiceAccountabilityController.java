package com.merhouse.web;

import com.merhouse.dto.CreateServiceAgreementRequest;
import com.merhouse.dto.CreateServiceClaimRequest;
import com.merhouse.dto.CreateServiceDisputeRequest;
import com.merhouse.dto.CreateServiceReviewRequest;
import com.merhouse.dto.CreateServiceStatementRequest;
import com.merhouse.dto.GenerateServiceStatementRequest;
import com.merhouse.dto.ResolveServiceClaimRequest;
import com.merhouse.dto.ResolveServiceDisputeRequest;
import com.merhouse.dto.ResolveServiceReviewRequest;
import com.merhouse.dto.ServiceAgreementResponse;
import com.merhouse.dto.ServiceClaimResponse;
import com.merhouse.dto.ServiceDisputeResponse;
import com.merhouse.dto.ServiceReviewResponse;
import com.merhouse.dto.ServiceStatementResponse;
import com.merhouse.dto.SlaStatusResponse;
import com.merhouse.service.ServiceAccountabilityService;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/service-accountability")
public class ServiceAccountabilityController {
    private final ServiceAccountabilityService serviceAccountabilityService;

    public ServiceAccountabilityController(ServiceAccountabilityService serviceAccountabilityService) {
        this.serviceAccountabilityService = serviceAccountabilityService;
    }

    @PostMapping("/agreements")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public ServiceAgreementResponse createAgreement(@Valid @RequestBody CreateServiceAgreementRequest request) {
        return serviceAccountabilityService.createAgreement(request);
    }

    @GetMapping("/agreements")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<ServiceAgreementResponse> listAgreements() {
        return serviceAccountabilityService.findAgreements();
    }

    @GetMapping("/agreements/{agreementId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceAgreementResponse getAgreement(@PathVariable UUID agreementId) {
        return serviceAccountabilityService.getAgreement(agreementId);
    }

    @PatchMapping("/agreements/{agreementId}/propose")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT')")
    public ServiceAgreementResponse proposeAgreement(@PathVariable UUID agreementId) {
        return serviceAccountabilityService.proposeAgreement(agreementId);
    }

    @PatchMapping("/agreements/{agreementId}/accept")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'WAREHOUSE_OPERATOR')")
    public ServiceAgreementResponse acceptAgreement(@PathVariable UUID agreementId) {
        return serviceAccountabilityService.acceptAgreement(agreementId);
    }

    @PatchMapping("/agreements/{agreementId}/suspend")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceAgreementResponse suspendAgreement(@PathVariable UUID agreementId) {
        return serviceAccountabilityService.suspendAgreement(agreementId);
    }

    @PatchMapping("/agreements/{agreementId}/end")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceAgreementResponse endAgreement(@PathVariable UUID agreementId) {
        return serviceAccountabilityService.endAgreement(agreementId);
    }

    @PostMapping("/agreements/{agreementId}/statements")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceStatementResponse createStatement(
        @PathVariable UUID agreementId,
        @Valid @RequestBody CreateServiceStatementRequest request
    ) {
        return serviceAccountabilityService.createStatement(agreementId, request);
    }

    @PostMapping("/agreements/{agreementId}/statements/generate")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceStatementResponse generateStatement(
        @PathVariable UUID agreementId,
        @Valid @RequestBody GenerateServiceStatementRequest request
    ) {
        return serviceAccountabilityService.generateStatement(agreementId, request);
    }

    @GetMapping("/agreements/{agreementId}/sla-statuses")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<SlaStatusResponse> listSlaStatuses(@PathVariable UUID agreementId) {
        return serviceAccountabilityService.findSlaStatuses(agreementId);
    }

    @PostMapping("/agreements/{agreementId}/claims")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceClaimResponse createClaim(
        @PathVariable UUID agreementId,
        @Valid @RequestBody CreateServiceClaimRequest request
    ) {
        return serviceAccountabilityService.createClaim(agreementId, request);
    }

    @PostMapping("/agreements/{agreementId}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceReviewResponse createReview(
        @PathVariable UUID agreementId,
        @Valid @RequestBody CreateServiceReviewRequest request
    ) {
        return serviceAccountabilityService.createReview(agreementId, request);
    }

    @GetMapping("/statements")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<ServiceStatementResponse> listStatements() {
        return serviceAccountabilityService.findStatements();
    }

    @GetMapping("/statements/{statementId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceStatementResponse getStatement(@PathVariable UUID statementId) {
        return serviceAccountabilityService.getStatement(statementId);
    }

    @PatchMapping("/statements/{statementId}/finalize")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceStatementResponse finalizeStatement(@PathVariable UUID statementId) {
        return serviceAccountabilityService.finalizeStatement(statementId);
    }

    @PatchMapping("/statements/{statementId}/mark-settled")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceStatementResponse markStatementSettled(@PathVariable UUID statementId) {
        return serviceAccountabilityService.markStatementSettled(statementId);
    }

    @PostMapping("/statements/{statementId}/disputes")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceDisputeResponse createDispute(
        @PathVariable UUID statementId,
        @Valid @RequestBody CreateServiceDisputeRequest request
    ) {
        return serviceAccountabilityService.createDispute(statementId, request);
    }

    @GetMapping("/disputes")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<ServiceDisputeResponse> listDisputes() {
        return serviceAccountabilityService.findDisputes();
    }

    @PatchMapping("/disputes/{disputeId}/resolve")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceDisputeResponse resolveDispute(
        @PathVariable UUID disputeId,
        @Valid @RequestBody ResolveServiceDisputeRequest request
    ) {
        return serviceAccountabilityService.resolveDispute(disputeId, request);
    }

    @GetMapping("/claims")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<ServiceClaimResponse> listClaims() {
        return serviceAccountabilityService.findClaims();
    }

    @PatchMapping("/claims/{claimId}/resolve")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceClaimResponse resolveClaim(
        @PathVariable UUID claimId,
        @Valid @RequestBody ResolveServiceClaimRequest request
    ) {
        return serviceAccountabilityService.resolveClaim(claimId, request);
    }

    @GetMapping("/reviews")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public List<ServiceReviewResponse> listReviews() {
        return serviceAccountabilityService.findReviews();
    }

    @PatchMapping("/reviews/{reviewId}/resolve")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
    public ServiceReviewResponse resolveReview(
        @PathVariable UUID reviewId,
        @Valid @RequestBody ResolveServiceReviewRequest request
    ) {
        return serviceAccountabilityService.resolveReview(reviewId, request);
    }
}
