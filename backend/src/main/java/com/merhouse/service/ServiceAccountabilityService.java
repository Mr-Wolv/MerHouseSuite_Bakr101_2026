package com.merhouse.service;

import com.merhouse.dto.AttentionSeverity;
import com.merhouse.dto.CreateServiceAgreementRequest;
import com.merhouse.dto.CreateServiceClaimRequest;
import com.merhouse.dto.CreateServiceDisputeRequest;
import com.merhouse.dto.CreateServiceReviewRequest;
import com.merhouse.dto.CreateServiceStatementRequest;
import com.merhouse.dto.GenerateServiceStatementRequest;
import com.merhouse.dto.RateCardRequest;
import com.merhouse.dto.ResolveServiceClaimRequest;
import com.merhouse.dto.ResolveServiceDisputeRequest;
import com.merhouse.dto.ResolveServiceReviewRequest;
import com.merhouse.dto.ServiceClaimResponse;
import com.merhouse.dto.ServiceAgreementResponse;
import com.merhouse.dto.ServiceDisputeResponse;
import com.merhouse.dto.ServiceReviewResponse;
import com.merhouse.dto.ServiceStatementLineRequest;
import com.merhouse.dto.ServiceStatementResponse;
import com.merhouse.dto.SlaStatusResponse;
import com.merhouse.dto.SlaPolicyRequest;
import com.merhouse.entity.FulfillmentAllocation;
import com.merhouse.entity.FulfillmentStatus;
import com.merhouse.entity.InboundStockRequest;
import com.merhouse.entity.InboundStockRequestStatus;
import com.merhouse.entity.MerchantWarehouseRelationship;
import com.merhouse.entity.MerchantWarehouseRelationshipStatus;
import com.merhouse.entity.ReferenceRateCard;
import com.merhouse.entity.ServiceClaim;
import com.merhouse.entity.ServiceClaimStatus;
import com.merhouse.entity.ServiceAgreement;
import com.merhouse.entity.ServiceAgreementStatus;
import com.merhouse.entity.ServiceDispute;
import com.merhouse.entity.ServiceDisputeStatus;
import com.merhouse.entity.ServiceReviewRequest;
import com.merhouse.entity.ServiceReviewStatus;
import com.merhouse.entity.ServiceScope;
import com.merhouse.entity.ServiceSourceType;
import com.merhouse.entity.ServiceStatement;
import com.merhouse.entity.ServiceStatementLine;
import com.merhouse.entity.ServiceStatementLineType;
import com.merhouse.entity.ServiceStatementStatus;
import com.merhouse.entity.Shipment;
import com.merhouse.entity.ShipmentStatus;
import com.merhouse.entity.SlaPolicy;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.FulfillmentAllocationRepository;
import com.merhouse.repository.InboundStockRequestRepository;
import com.merhouse.repository.MerchantWarehouseRelationshipRepository;
import com.merhouse.repository.ServiceClaimRepository;
import com.merhouse.repository.ServiceAgreementRepository;
import com.merhouse.repository.ServiceDisputeRepository;
import com.merhouse.repository.ServiceReviewRequestRepository;
import com.merhouse.repository.ServiceStatementRepository;
import com.merhouse.repository.ShipmentRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ServiceAccountabilityService {
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100.00");

    private final MerchantWarehouseRelationshipRepository relationshipRepository;
    private final ServiceAgreementRepository agreementRepository;
    private final ServiceStatementRepository statementRepository;
    private final ServiceDisputeRepository disputeRepository;
    private final ServiceClaimRepository claimRepository;
    private final ServiceReviewRequestRepository reviewRepository;
    private final InboundStockRequestRepository inboundRepository;
    private final FulfillmentAllocationRepository allocationRepository;
    private final ShipmentRepository shipmentRepository;
    private final ServiceAccountabilityAlertService alertService;
    private final CurrentUserService currentUserService;

    public ServiceAccountabilityService(
        MerchantWarehouseRelationshipRepository relationshipRepository,
        ServiceAgreementRepository agreementRepository,
        ServiceStatementRepository statementRepository,
        ServiceDisputeRepository disputeRepository,
        ServiceClaimRepository claimRepository,
        ServiceReviewRequestRepository reviewRepository,
        InboundStockRequestRepository inboundRepository,
        FulfillmentAllocationRepository allocationRepository,
        ShipmentRepository shipmentRepository,
        ServiceAccountabilityAlertService alertService,
        CurrentUserService currentUserService
    ) {
        this.relationshipRepository = relationshipRepository;
        this.agreementRepository = agreementRepository;
        this.statementRepository = statementRepository;
        this.disputeRepository = disputeRepository;
        this.claimRepository = claimRepository;
        this.reviewRepository = reviewRepository;
        this.inboundRepository = inboundRepository;
        this.allocationRepository = allocationRepository;
        this.shipmentRepository = shipmentRepository;
        this.alertService = alertService;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public ServiceAgreementResponse createAgreement(CreateServiceAgreementRequest request) {
        MerchantWarehouseRelationship relationship = getRequiredRelationship(request.relationshipId());
        currentUserService.requireMutatingAdminOrTenant(relationship.getMerchant().getId());
        if (relationship.getStatus() != MerchantWarehouseRelationshipStatus.ACTIVE) {
            throw new DomainConflictException("Service agreements require an active merchant-warehouse relationship.");
        }
        if (request.renewalReviewDate() != null && request.renewalReviewDate().isBefore(request.effectiveDate())) {
            throw new DomainConflictException("Renewal review date cannot be before the agreement effective date.");
        }

        ServiceAgreement agreement = new ServiceAgreement();
        agreement.setRelationship(relationship);
        agreement.setMerchant(relationship.getMerchant());
        agreement.setWarehouseProvider(relationship.getWarehouseProvider());
        agreement.setStatus(ServiceAgreementStatus.DRAFT);
        agreement.setTitle(request.title().trim());
        agreement.setVersionNumber((int) agreementRepository.countByRelationshipId(relationship.getId()) + 1);
        agreement.setEffectiveDate(request.effectiveDate());
        agreement.setRenewalReviewDate(request.renewalReviewDate());
        agreement.setCancellationWindowDays(defaultInt(request.cancellationWindowDays()));
        agreement.setServiceScopes(scopesToString(request.serviceScopes()));
        agreement.setServiceNotes(trimToNull(request.serviceNotes()));
        agreement.setRateCard(rateCardFrom(request.rateCard()));
        agreement.setSlaPolicy(slaPolicyFrom(request.slaPolicy()));
        if (request.supersedesAgreementId() != null) {
            ServiceAgreement superseded = getRequiredAgreement(request.supersedesAgreementId());
            requireSameRelationship(relationship, superseded);
            agreement.setSupersedesAgreement(superseded);
        }

        return ServiceAgreementResponse.from(agreementRepository.saveAndFlush(agreement));
    }

    @Transactional(readOnly = true)
    public List<ServiceAgreementResponse> findAgreements() {
        if (currentUserService.isAdmin()) {
            return agreementRepository.findAll().stream()
                .sorted(Comparator.comparing(ServiceAgreement::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(ServiceAgreementResponse::from)
                .toList();
        }

        UUID tenantId = currentUserService.required().tenantId();
        if (currentUserService.hasRole(UserRole.MERCHANT)) {
            return agreementRepository.findByMerchantIdOrderByCreatedAtDesc(tenantId).stream()
                .map(ServiceAgreementResponse::from)
                .toList();
        }
        return agreementRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream()
            .map(ServiceAgreementResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public ServiceAgreementResponse getAgreement(UUID agreementId) {
        ServiceAgreement agreement = getRequiredAgreement(agreementId);
        requireAgreementPartyAccess(agreement);
        return ServiceAgreementResponse.from(agreement);
    }

    @Transactional
    public ServiceAgreementResponse proposeAgreement(UUID agreementId) {
        ServiceAgreement agreement = getRequiredAgreement(agreementId);
        currentUserService.requireMutatingAdminOrTenant(agreement.getMerchant().getId());
        if (agreement.getStatus() != ServiceAgreementStatus.DRAFT) {
            throw new DomainConflictException("Only DRAFT service agreements can be proposed.");
        }
        agreement.setStatus(ServiceAgreementStatus.PROPOSED);
        agreement.setProposedAt(Instant.now());
        ServiceAgreement saved = agreementRepository.saveAndFlush(agreement);
        alertService.recordWarehouseAlert(
            saved.getWarehouseProvider().getId(),
            "Service agreement proposed",
            saved.getMerchant().getName() + " proposed " + saved.getTitle() + ".",
            "ServiceAgreement",
            saved.getId()
        );
        return ServiceAgreementResponse.from(saved);
    }

    @Transactional
    public ServiceAgreementResponse acceptAgreement(UUID agreementId) {
        ServiceAgreement agreement = getRequiredAgreement(agreementId);
        currentUserService.requireMutatingAdminOrTenant(agreement.getWarehouseProvider().getId());
        if (agreement.getStatus() != ServiceAgreementStatus.PROPOSED) {
            throw new DomainConflictException("Only PROPOSED service agreements can be accepted.");
        }
        Instant now = Instant.now();
        agreement.setStatus(ServiceAgreementStatus.ACTIVE);
        agreement.setAcceptedAt(now);
        agreement.setActivatedAt(now);
        if (agreement.getSupersedesAgreement() != null
            && agreement.getSupersedesAgreement().getStatus() == ServiceAgreementStatus.ACTIVE) {
            agreement.getSupersedesAgreement().setStatus(ServiceAgreementStatus.SUPERSEDED);
            agreementRepository.saveAndFlush(agreement.getSupersedesAgreement());
        }
        ServiceAgreement saved = agreementRepository.saveAndFlush(agreement);
        alertService.recordMerchantAlert(
            saved.getMerchant().getId(),
            "Service agreement active",
            saved.getWarehouseProvider().getName() + " accepted " + saved.getTitle() + ".",
            "ServiceAgreement",
            saved.getId()
        );
        return ServiceAgreementResponse.from(saved);
    }

    @Transactional
    public ServiceAgreementResponse suspendAgreement(UUID agreementId) {
        ServiceAgreement agreement = getRequiredAgreement(agreementId);
        requireAgreementPartyMutation(agreement);
        if (agreement.getStatus() != ServiceAgreementStatus.ACTIVE) {
            throw new DomainConflictException("Only ACTIVE service agreements can be suspended.");
        }
        agreement.setStatus(ServiceAgreementStatus.SUSPENDED);
        agreement.setSuspendedAt(Instant.now());
        ServiceAgreement saved = agreementRepository.saveAndFlush(agreement);
        alertService.recordCounterpartyAlert(
            saved,
            "Service agreement suspended",
            saved.getTitle() + " was suspended.",
            "ServiceAgreement",
            saved.getId()
        );
        return ServiceAgreementResponse.from(saved);
    }

    @Transactional
    public ServiceAgreementResponse endAgreement(UUID agreementId) {
        ServiceAgreement agreement = getRequiredAgreement(agreementId);
        requireAgreementPartyMutation(agreement);
        if (agreement.getStatus() != ServiceAgreementStatus.ACTIVE
            && agreement.getStatus() != ServiceAgreementStatus.SUSPENDED) {
            throw new DomainConflictException("Only ACTIVE or SUSPENDED service agreements can be ended.");
        }
        agreement.setStatus(ServiceAgreementStatus.ENDED);
        agreement.setEndedAt(Instant.now());
        ServiceAgreement saved = agreementRepository.saveAndFlush(agreement);
        alertService.recordCounterpartyAlert(
            saved,
            "Service agreement ended",
            saved.getTitle() + " was ended.",
            "ServiceAgreement",
            saved.getId()
        );
        return ServiceAgreementResponse.from(saved);
    }

    @Transactional
    public ServiceStatementResponse createStatement(UUID agreementId, CreateServiceStatementRequest request) {
        ServiceAgreement agreement = getRequiredAgreement(agreementId);
        requireAgreementPartyMutation(agreement);
        if (agreement.getStatus() != ServiceAgreementStatus.ACTIVE) {
            throw new DomainConflictException("Service statements require an ACTIVE service agreement.");
        }
        if (request.periodEnd().isBefore(request.periodStart())) {
            throw new DomainConflictException("Service statement period end cannot be before period start.");
        }
        if (request.dueDate().isBefore(request.periodEnd())) {
            throw new DomainConflictException("Service statement due date cannot be before period end.");
        }
        String idempotencyKey = trimToNull(request.idempotencyKey());
        if (idempotencyKey != null) {
            return statementRepository.findByIdempotencyKey(idempotencyKey)
                .map(existing -> {
                    if (!existing.getAgreement().getId().equals(agreement.getId())) {
                        throw new DomainConflictException("Service statement idempotency key belongs to another agreement.");
                    }
                    requireStatementMutation(existing);
                    return ServiceStatementResponse.from(existing);
                })
                .orElseGet(() -> createStatementRecord(agreement, request, idempotencyKey));
        }
        return createStatementRecord(agreement, request, null);
    }

    @Transactional
    public ServiceStatementResponse generateStatement(UUID agreementId, GenerateServiceStatementRequest request) {
        List<ServiceStatementLineRequest> lines = new ArrayList<>();
        ServiceAgreement agreement = getRequiredAgreement(agreementId);
        requireAgreementPartyMutation(agreement);
        ReferenceRateCard rateCard = agreement.getRateCard();

        for (UUID inboundId : safeIds(request.inboundStockRequestIds())) {
            InboundStockRequest inbound = inboundRepository.findWithDetailsById(inboundId)
                .orElseThrow(() -> new ResourceNotFoundException("Inbound stock request not found: " + inboundId));
            requireAgreementSource(agreement, inbound.getRelationship().getId(), inbound.getMerchant().getId(), inbound.getWarehouseProvider().getId());
            lines.add(new ServiceStatementLineRequest(
                ServiceStatementLineType.RECEIVING,
                ServiceSourceType.INBOUND_STOCK_REQUEST,
                inbound.getId(),
                "Inbound receiving for " + inbound.getMerchantReference(),
                Math.max(1, inbound.getReceivedQuantity()),
                rateCard.getInboundReceivingFeePerUnit()
            ));
            int shortage = Math.max(0, inbound.getRequestedQuantity() - inbound.getReceivedQuantity());
            if (shortage > 0 || inbound.getDamagedQuantity() > 0) {
                lines.add(new ServiceStatementLineRequest(
                    ServiceStatementLineType.CREDIT,
                    ServiceSourceType.INBOUND_STOCK_REQUEST,
                    inbound.getId(),
                    "Receiving accuracy review: " + shortage + " short, " + inbound.getDamagedQuantity() + " damaged",
                    1,
                    BigDecimal.ZERO
                ));
            }
        }
        for (UUID allocationId : safeIds(request.fulfillmentAllocationIds())) {
            FulfillmentAllocation allocation = allocationRepository.findWithDetailsById(allocationId)
                .orElseThrow(() -> new ResourceNotFoundException("Fulfillment allocation not found: " + allocationId));
            requireAgreementSource(agreement, null, allocation.getOrder().getMerchant().getId(), allocation.getWarehouse().getTenant().getId());
            lines.add(new ServiceStatementLineRequest(
                ServiceStatementLineType.PICK_PACK,
                ServiceSourceType.FULFILLMENT_ALLOCATION,
                allocation.getId(),
                "Pick/pack service for allocation " + allocation.getId(),
                Math.max(1, allocation.getItems().size()),
                rateCard.getPickFeePerLine().add(rateCard.getPackFeePerOrder())
            ));
        }
        for (UUID shipmentId : safeIds(request.shipmentIds())) {
            Shipment shipment = shipmentRepository.findWithDetailsById(shipmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Shipment not found: " + shipmentId));
            requireAgreementSource(agreement, null, shipment.getAllocation().getOrder().getMerchant().getId(), shipment.getAllocation().getWarehouse().getTenant().getId());
            lines.add(new ServiceStatementLineRequest(
                ServiceStatementLineType.SHIPMENT_HANDOFF,
                ServiceSourceType.SHIPMENT,
                shipment.getId(),
                "Shipment handoff through " + shipment.getCarrier(),
                1,
                rateCard.getShipmentHandlingFee()
            ));
        }
        if (lines.isEmpty()) {
            throw new DomainConflictException("Generated service statement requires at least one operational source.");
        }
        return createStatement(agreementId, new CreateServiceStatementRequest(
            request.periodStart(),
            request.periodEnd(),
            request.dueDate(),
            request.idempotencyKey(),
            request.note(),
            lines
        ));
    }

    @Transactional(readOnly = true)
    public List<ServiceStatementResponse> findStatements() {
        if (currentUserService.isAdmin()) {
            return statementRepository.findAll().stream()
                .sorted(Comparator.comparing(ServiceStatement::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(ServiceStatementResponse::from)
                .toList();
        }

        UUID tenantId = currentUserService.required().tenantId();
        if (currentUserService.hasRole(UserRole.MERCHANT)) {
            return statementRepository.findByMerchantIdOrderByCreatedAtDesc(tenantId).stream()
                .map(ServiceStatementResponse::from)
                .toList();
        }
        return statementRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream()
            .map(ServiceStatementResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public ServiceStatementResponse getStatement(UUID statementId) {
        ServiceStatement statement = getRequiredStatement(statementId);
        requireStatementMutation(statement);
        return ServiceStatementResponse.from(statement);
    }

    @Transactional
    public ServiceStatementResponse finalizeStatement(UUID statementId) {
        ServiceStatement statement = getRequiredStatement(statementId);
        requireStatementMutation(statement);
        if (statement.getStatus() != ServiceStatementStatus.DRAFT) {
            throw new DomainConflictException("Only DRAFT service statements can be finalized.");
        }
        statement.setStatus(ServiceStatementStatus.FINALIZED);
        statement.setFinalizedAt(Instant.now());
        ServiceStatement saved = statementRepository.saveAndFlush(statement);
        alertService.recordCounterpartyAlert(
            saved.getAgreement(),
            "Service statement finalized",
            "Statement for " + saved.getPeriodStart() + " to " + saved.getPeriodEnd()
                + " is ready for review.",
            "ServiceStatement",
            saved.getId()
        );
        return ServiceStatementResponse.from(saved);
    }

    @Transactional
    public ServiceStatementResponse markStatementSettled(UUID statementId) {
        ServiceStatement statement = getRequiredStatement(statementId);
        requireStatementMutation(statement);
        if (statement.getStatus() != ServiceStatementStatus.FINALIZED) {
            throw new DomainConflictException("Only FINALIZED service statements can be marked settled.");
        }
        statement.setStatus(ServiceStatementStatus.MARKED_SETTLED);
        statement.setSettlementMarkedAt(Instant.now());
        ServiceStatement saved = statementRepository.saveAndFlush(statement);
        alertService.recordCounterpartyAlert(
            saved.getAgreement(),
            "Service statement settled",
            "Statement for " + saved.getPeriodStart() + " to " + saved.getPeriodEnd()
                + " was marked settled.",
            "ServiceStatement",
            saved.getId()
        );
        return ServiceStatementResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<SlaStatusResponse> findSlaStatuses(UUID agreementId) {
        ServiceAgreement agreement = getRequiredAgreement(agreementId);
        requireAgreementPartyAccess(agreement);
        List<SlaStatusResponse> statuses = new ArrayList<>();
        for (InboundStockRequest inbound : inboundRepository.findByMerchantIdOrderByCreatedAtDesc(agreement.getMerchant().getId())) {
            if (inbound.getRelationship().getId().equals(agreement.getRelationship().getId())) {
                statuses.add(slaStatus(ServiceSourceType.INBOUND_STOCK_REQUEST, inbound.getId(), agreement.getSlaPolicy().getReceivingSlaHours(), inbound.getCreatedAt(), inbound.getReceivedAt(), inbound.getStatus() == InboundStockRequestStatus.RECEIVED));
            }
        }
        for (FulfillmentAllocation allocation : allocationRepository.findByWarehouseTenantIdOrderByCreatedAtDesc(agreement.getWarehouseProvider().getId())) {
            if (allocation.getOrder().getMerchant().getId().equals(agreement.getMerchant().getId())) {
                boolean completed = allocation.getStatus() == FulfillmentStatus.PACKED || allocation.getStatus() == FulfillmentStatus.SHIPPED;
                statuses.add(slaStatus(ServiceSourceType.FULFILLMENT_ALLOCATION, allocation.getId(), agreement.getSlaPolicy().getPickPackSlaHours(), allocation.getCreatedAt(), null, completed));
            }
        }
        return statuses;
    }

    @Transactional
    public ServiceDisputeResponse createDispute(UUID statementId, CreateServiceDisputeRequest request) {
        ServiceStatement statement = getRequiredStatement(statementId);
        requireStatementMutation(statement);
        ServiceStatementLine line = null;
        if (request.statementLineId() != null) {
            line = statement.getLines().stream()
                .filter(candidate -> candidate.getId().equals(request.statementLineId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Service statement line not found: " + request.statementLineId()));
        }
        statement.setStatus(ServiceStatementStatus.DISPUTED);
        ServiceDispute dispute = new ServiceDispute();
        dispute.setAgreement(statement.getAgreement());
        dispute.setStatement(statement);
        dispute.setStatementLine(line);
        dispute.setMerchant(statement.getMerchant());
        dispute.setWarehouseProvider(statement.getWarehouseProvider());
        dispute.setReason(request.reason().trim());
        dispute.setEvidenceNote(trimToNull(request.evidenceNote()));
        ServiceDispute saved = disputeRepository.saveAndFlush(dispute);
        alertService.recordCounterpartyAlert(
            saved.getAgreement(),
            "Service dispute opened",
            saved.getReason(),
            "ServiceDispute",
            saved.getId()
        );
        return ServiceDisputeResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ServiceDisputeResponse> findDisputes() {
        if (currentUserService.isAdmin()) {
            return disputeRepository.findAll().stream()
                .sorted(Comparator.comparing(ServiceDispute::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(ServiceDisputeResponse::from)
                .toList();
        }
        UUID tenantId = currentUserService.required().tenantId();
        return currentUserService.hasRole(UserRole.MERCHANT)
            ? disputeRepository.findByMerchantIdOrderByCreatedAtDesc(tenantId).stream().map(ServiceDisputeResponse::from).toList()
            : disputeRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream().map(ServiceDisputeResponse::from).toList();
    }

    @Transactional
    public ServiceDisputeResponse resolveDispute(UUID disputeId, ResolveServiceDisputeRequest request) {
        ServiceDispute dispute = disputeRepository.findWithDetailsById(disputeId)
            .orElseThrow(() -> new ResourceNotFoundException("Service dispute not found: " + disputeId));
        requireAgreementPartyMutation(dispute.getAgreement());
        if (dispute.getStatus() != ServiceDisputeStatus.OPEN) {
            throw new DomainConflictException("Only OPEN service disputes can be resolved.");
        }
        if (request.status() == ServiceDisputeStatus.OPEN) {
            throw new DomainConflictException("Resolved dispute status must be RESOLVED or REJECTED.");
        }
        dispute.setStatus(request.status());
        dispute.setOutcomeNote(trimToNull(request.outcomeNote()));
        dispute.setResolvedAt(Instant.now());
        ServiceDispute saved = disputeRepository.saveAndFlush(dispute);
        alertService.recordCounterpartyAlert(
            saved.getAgreement(),
            "Service dispute " + saved.getStatus().name().toLowerCase(),
            saved.getOutcomeNote() == null ? saved.getReason() : saved.getOutcomeNote(),
            "ServiceDispute",
            saved.getId()
        );
        return ServiceDisputeResponse.from(saved);
    }

    @Transactional
    public ServiceClaimResponse createClaim(UUID agreementId, CreateServiceClaimRequest request) {
        ServiceAgreement agreement = getRequiredAgreement(agreementId);
        requireAgreementPartyMutation(agreement);
        ServiceClaim claim = new ServiceClaim();
        claim.setAgreement(agreement);
        claim.setMerchant(agreement.getMerchant());
        claim.setWarehouseProvider(agreement.getWarehouseProvider());
        claim.setSourceType(request.sourceType());
        claim.setSourceId(request.sourceId());
        claim.setClaimType(request.claimType().trim());
        claim.setReason(request.reason().trim());
        claim.setEvidenceNote(trimToNull(request.evidenceNote()));
        ServiceClaim saved = claimRepository.saveAndFlush(claim);
        alertService.recordCounterpartyAlert(
            saved.getAgreement(),
            "Service claim opened",
            saved.getClaimType() + ": " + saved.getReason(),
            "ServiceClaim",
            saved.getId()
        );
        return ServiceClaimResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ServiceClaimResponse> findClaims() {
        if (currentUserService.isAdmin()) {
            return claimRepository.findAll().stream()
                .sorted(Comparator.comparing(ServiceClaim::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(ServiceClaimResponse::from)
                .toList();
        }
        UUID tenantId = currentUserService.required().tenantId();
        return currentUserService.hasRole(UserRole.MERCHANT)
            ? claimRepository.findByMerchantIdOrderByCreatedAtDesc(tenantId).stream().map(ServiceClaimResponse::from).toList()
            : claimRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream().map(ServiceClaimResponse::from).toList();
    }

    @Transactional
    public ServiceClaimResponse resolveClaim(UUID claimId, ResolveServiceClaimRequest request) {
        ServiceClaim claim = claimRepository.findWithDetailsById(claimId)
            .orElseThrow(() -> new ResourceNotFoundException("Service claim not found: " + claimId));
        requireAgreementPartyMutation(claim.getAgreement());
        if (claim.getStatus() != ServiceClaimStatus.OPEN) {
            throw new DomainConflictException("Only OPEN service claims can be resolved.");
        }
        if (request.status() == ServiceClaimStatus.OPEN) {
            throw new DomainConflictException("Resolved claim status must be RESOLVED or REJECTED.");
        }
        claim.setStatus(request.status());
        claim.setOutcomeNote(trimToNull(request.outcomeNote()));
        claim.setResolvedAt(Instant.now());
        ServiceClaim saved = claimRepository.saveAndFlush(claim);
        alertService.recordCounterpartyAlert(
            saved.getAgreement(),
            "Service claim " + saved.getStatus().name().toLowerCase(),
            saved.getOutcomeNote() == null ? saved.getReason() : saved.getOutcomeNote(),
            "ServiceClaim",
            saved.getId()
        );
        return ServiceClaimResponse.from(saved);
    }

    @Transactional
    public ServiceReviewResponse createReview(UUID agreementId, CreateServiceReviewRequest request) {
        ServiceAgreement agreement = getRequiredAgreement(agreementId);
        requireAgreementPartyMutation(agreement);
        ServiceReviewRequest review = new ServiceReviewRequest();
        review.setAgreement(agreement);
        review.setMerchant(agreement.getMerchant());
        review.setWarehouseProvider(agreement.getWarehouseProvider());
        review.setReviewType(request.reviewType());
        review.setReason(request.reason().trim());
        review.setEvidenceNote(trimToNull(request.evidenceNote()));
        review.setRequestedBy(currentUserService.required().getUsername());
        ServiceReviewRequest saved = reviewRepository.saveAndFlush(review);
        alertService.recordCounterpartyAlert(
            saved.getAgreement(),
            "Service review requested",
            saved.getReviewType().name() + ": " + saved.getReason(),
            "ServiceReviewRequest",
            saved.getId()
        );
        return ServiceReviewResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ServiceReviewResponse> findReviews() {
        if (currentUserService.isAdmin()) {
            return reviewRepository.findAll().stream()
                .sorted(Comparator.comparing(ServiceReviewRequest::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(ServiceReviewResponse::from)
                .toList();
        }
        UUID tenantId = currentUserService.required().tenantId();
        return currentUserService.hasRole(UserRole.MERCHANT)
            ? reviewRepository.findByMerchantIdOrderByCreatedAtDesc(tenantId).stream().map(ServiceReviewResponse::from).toList()
            : reviewRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream().map(ServiceReviewResponse::from).toList();
    }

    @Transactional
    public ServiceReviewResponse resolveReview(UUID reviewId, ResolveServiceReviewRequest request) {
        ServiceReviewRequest review = reviewRepository.findWithDetailsById(reviewId)
            .orElseThrow(() -> new ResourceNotFoundException("Service review request not found: " + reviewId));
        requireAgreementPartyMutation(review.getAgreement());
        if (review.getStatus() != ServiceReviewStatus.PENDING) {
            throw new DomainConflictException("Only PENDING service reviews can be resolved.");
        }
        if (request.status() == ServiceReviewStatus.PENDING) {
            throw new DomainConflictException("Resolved review status must be APPROVED or REJECTED.");
        }
        review.setStatus(request.status());
        review.setOutcomeNote(trimToNull(request.outcomeNote()));
        review.setReviewedAt(Instant.now());
        ServiceReviewRequest saved = reviewRepository.saveAndFlush(review);
        alertService.recordCounterpartyAlert(
            saved.getAgreement(),
            "Service review " + saved.getStatus().name().toLowerCase(),
            saved.getOutcomeNote() == null ? saved.getReason() : saved.getOutcomeNote(),
            "ServiceReviewRequest",
            saved.getId()
        );
        return ServiceReviewResponse.from(saved);
    }

    private ServiceStatementResponse createStatementRecord(
        ServiceAgreement agreement,
        CreateServiceStatementRequest request,
        String idempotencyKey
    ) {
        ServiceStatement statement = new ServiceStatement();
        statement.setAgreement(agreement);
        statement.setMerchant(agreement.getMerchant());
        statement.setWarehouseProvider(agreement.getWarehouseProvider());
        statement.setStatus(ServiceStatementStatus.DRAFT);
        statement.setPeriodStart(request.periodStart());
        statement.setPeriodEnd(request.periodEnd());
        statement.setDueDate(request.dueDate());
        statement.setIdempotencyKey(idempotencyKey);
        statement.setNote(trimToNull(request.note()));

        BigDecimal subtotal = BigDecimal.ZERO;
        for (ServiceStatementLineRequest lineRequest : request.lines()) {
            ServiceStatementLine line = new ServiceStatementLine();
            line.setLineType(lineRequest.lineType());
            line.setSourceType(lineRequest.sourceType());
            line.setSourceId(lineRequest.sourceId());
            line.setDescription(lineRequest.description().trim());
            line.setQuantity(lineRequest.quantity());
            line.setUnitAmount(money(lineRequest.unitAmount()));
            line.setLineAmount(money(lineRequest.unitAmount().multiply(BigDecimal.valueOf(lineRequest.quantity()))));
            statement.addLine(line);
            subtotal = subtotal.add(line.getLineAmount());
        }

        BigDecimal coordinationFee = coordinationFee(agreement.getRateCard(), subtotal);
        statement.setSubtotalAmount(money(subtotal));
        statement.setCoordinationFeeAmount(coordinationFee);
        statement.setAdjustmentAmount(BigDecimal.ZERO.setScale(2));
        statement.setTotalAmount(money(subtotal.add(coordinationFee)));

        return ServiceStatementResponse.from(statementRepository.saveAndFlush(statement));
    }

    private BigDecimal coordinationFee(ReferenceRateCard rateCard, BigDecimal subtotal) {
        BigDecimal percentage = subtotal
            .multiply(rateCard.getCoordinationFeePercent())
            .divide(ONE_HUNDRED, 2, RoundingMode.HALF_UP);
        return money(percentage.add(rateCard.getFixedCoordinationFee()));
    }

    private List<UUID> safeIds(List<UUID> ids) {
        return ids == null ? List.of() : ids;
    }

    private void requireAgreementSource(ServiceAgreement agreement, UUID relationshipId, UUID merchantId, UUID warehouseProviderId) {
        if (relationshipId != null && !agreement.getRelationship().getId().equals(relationshipId)) {
            throw new DomainConflictException("Operational source does not belong to the service agreement relationship.");
        }
        if (!agreement.getMerchant().getId().equals(merchantId) || !agreement.getWarehouseProvider().getId().equals(warehouseProviderId)) {
            throw new DomainConflictException("Operational source does not belong to the service agreement parties.");
        }
    }

    private SlaStatusResponse slaStatus(ServiceSourceType sourceType, UUID sourceId, int targetHours, Instant startedAt, Instant completedAt, boolean terminalComplete) {
        Instant end = completedAt == null ? Instant.now() : completedAt;
        long elapsedHours = Math.max(0, Duration.between(startedAt, end).toHours());
        String status;
        if (terminalComplete) {
            status = elapsedHours <= targetHours ? "MET" : "MISSED";
        } else {
            status = elapsedHours <= targetHours ? "ON_TRACK" : "AT_RISK";
        }
        return new SlaStatusResponse(
            sourceType,
            sourceId,
            status,
            targetHours,
            elapsedHours,
            status + " within " + targetHours + "h target",
            "AT_RISK".equals(status) || "MISSED".equals(status)
                ? AttentionSignalFactory.signal(
                    "sla-" + sourceType + "-" + sourceId,
                    "MISSED".equals(status) ? AttentionSeverity.CRITICAL : AttentionSeverity.ACTION_NEEDED,
                    "SLA " + status.toLowerCase().replace('_', ' '),
                    sourceType + " has used " + elapsedHours + " of " + targetHours + " target hours.",
                    currentUserService.required().role() == UserRole.WAREHOUSE_OPERATOR ? UserRole.WAREHOUSE_OPERATOR : UserRole.MERCHANT,
                    "Review service record",
                    "/service-accountability",
                    sourceType.name(),
                    sourceId,
                    startedAt
                )
                : null
        );
    }

    private MerchantWarehouseRelationship getRequiredRelationship(UUID relationshipId) {
        return relationshipRepository.findWithDetailsById(relationshipId)
            .orElseThrow(() -> new ResourceNotFoundException("Merchant-warehouse relationship not found: " + relationshipId));
    }

    private ServiceAgreement getRequiredAgreement(UUID agreementId) {
        return agreementRepository.findWithDetailsById(agreementId)
            .orElseThrow(() -> new ResourceNotFoundException("Service agreement not found: " + agreementId));
    }

    private ServiceStatement getRequiredStatement(UUID statementId) {
        return statementRepository.findWithDetailsById(statementId)
            .orElseThrow(() -> new ResourceNotFoundException("Service statement not found: " + statementId));
    }

    private void requireAgreementPartyAccess(ServiceAgreement agreement) {
        if (currentUserService.isAdmin()) {
            return;
        }
        UUID tenantId = currentUserService.required().tenantId();
        if (!tenantId.equals(agreement.getMerchant().getId()) && !tenantId.equals(agreement.getWarehouseProvider().getId())) {
            throw new AccessDeniedException("You cannot access service records for another relationship.");
        }
    }

    private void requireAgreementPartyMutation(ServiceAgreement agreement) {
        if (currentUserService.canMutatePlatform()) {
            return;
        }
        UUID tenantId = currentUserService.required().tenantId();
        if (!tenantId.equals(agreement.getMerchant().getId()) && !tenantId.equals(agreement.getWarehouseProvider().getId())) {
            throw new AccessDeniedException("You cannot mutate service records for another relationship.");
        }
    }

    private void requireStatementAccess(ServiceStatement statement) {
        if (currentUserService.isAdmin()) {
            return;
        }
        UUID tenantId = currentUserService.required().tenantId();
        if (!tenantId.equals(statement.getMerchant().getId()) && !tenantId.equals(statement.getWarehouseProvider().getId())) {
            throw new AccessDeniedException("You cannot access service statements for another relationship.");
        }
    }

    private void requireStatementMutation(ServiceStatement statement) {
        if (currentUserService.canMutatePlatform()) {
            return;
        }
        UUID tenantId = currentUserService.required().tenantId();
        if (!tenantId.equals(statement.getMerchant().getId()) && !tenantId.equals(statement.getWarehouseProvider().getId())) {
            throw new AccessDeniedException("You cannot mutate service statements for another relationship.");
        }
    }

    private void requireSameRelationship(MerchantWarehouseRelationship relationship, ServiceAgreement agreement) {
        if (!agreement.getRelationship().getId().equals(relationship.getId())) {
            throw new DomainConflictException("Superseded agreement must belong to the same relationship.");
        }
    }

    private ReferenceRateCard rateCardFrom(RateCardRequest request) {
        RateCardRequest safe = request == null ? new RateCardRequest(
            null, null, null, null, null, null, null, null, null, null, null, null, null, null
        ) : request;
        ReferenceRateCard card = new ReferenceRateCard();
        card.setInboundReceivingFeePerUnit(money(defaultMoney(safe.inboundReceivingFeePerUnit())));
        card.setStorageFeePerUnitPerDay(money(defaultMoney(safe.storageFeePerUnitPerDay())));
        card.setFreeStorageDays(defaultInt(safe.freeStorageDays()));
        card.setMinimumMonthlyServiceCharge(money(defaultMoney(safe.minimumMonthlyServiceCharge())));
        card.setPickFeePerOrder(money(defaultMoney(safe.pickFeePerOrder())));
        card.setPickFeePerLine(money(defaultMoney(safe.pickFeePerLine())));
        card.setPackFeePerOrder(money(defaultMoney(safe.packFeePerOrder())));
        card.setPackagingFeePerPackage(money(defaultMoney(safe.packagingFeePerPackage())));
        card.setShipmentHandlingFee(money(defaultMoney(safe.shipmentHandlingFee())));
        card.setReturnRestockFee(money(defaultMoney(safe.returnRestockFee())));
        card.setExceptionHandlingFee(money(defaultMoney(safe.exceptionHandlingFee())));
        card.setCoordinationFeePercent(money(defaultMoney(safe.coordinationFeePercent())));
        card.setFixedCoordinationFee(money(defaultMoney(safe.fixedCoordinationFee())));
        card.setCarrierPassThroughNote(trimToNull(safe.carrierPassThroughNote()));
        return card;
    }

    private SlaPolicy slaPolicyFrom(SlaPolicyRequest request) {
        SlaPolicy policy = new SlaPolicy();
        policy.setReceivingSlaHours(defaultPositive(request == null ? null : request.receivingSlaHours(), 48));
        policy.setPickPackSlaHours(defaultPositive(request == null ? null : request.pickPackSlaHours(), 24));
        policy.setShipmentHandoffSlaHours(defaultPositive(request == null ? null : request.shipmentHandoffSlaHours(), 24));
        policy.setExceptionResponseSlaHours(defaultPositive(request == null ? null : request.exceptionResponseSlaHours(), 24));
        policy.setPauseRuleNotes(trimToNull(request == null ? null : request.pauseRuleNotes()));
        return policy;
    }

    private String scopesToString(List<ServiceScope> scopes) {
        return scopes.stream()
            .distinct()
            .map(ServiceScope::name)
            .collect(Collectors.joining(","));
    }

    private int defaultInt(Integer value) {
        return value == null ? 0 : value;
    }

    private int defaultPositive(Integer value, int defaultValue) {
        return value == null ? defaultValue : value;
    }

    private BigDecimal defaultMoney(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
