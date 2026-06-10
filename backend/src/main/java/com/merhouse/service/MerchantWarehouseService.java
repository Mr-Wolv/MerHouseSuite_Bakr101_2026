package com.merhouse.service;

import com.merhouse.dto.CreateInboundStockRequest;
import com.merhouse.dto.CreateMerchantWarehouseRelationshipRequest;
import com.merhouse.dto.InboundStockRequestResponse;
import com.merhouse.dto.MerchantAuthorizedStockResponse;
import com.merhouse.dto.MerchantWarehouseRelationshipResponse;
import com.merhouse.dto.ReceiveInboundStockRequest;
import com.merhouse.dto.RejectInboundStockRequest;
import com.merhouse.dto.WarehouseProviderOptionResponse;
import com.merhouse.entity.InboundStockRequest;
import com.merhouse.entity.InboundStockRequestStatus;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.MerchantWarehouseRelationship;
import com.merhouse.entity.MerchantWarehouseRelationshipStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.entity.Warehouse;
import com.merhouse.entity.WarehouseInventory;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.InboundStockRequestRepository;
import com.merhouse.repository.MerchantWarehouseRelationshipRepository;
import com.merhouse.repository.WarehouseInventoryRepository;
import com.merhouse.repository.WarehouseRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MerchantWarehouseService {
    private final TenantService tenantService;
    private final WarehouseService warehouseService;
    private final WarehouseRepository warehouseRepository;
    private final InventoryService inventoryService;
    private final WarehouseInventoryRepository warehouseInventoryRepository;
    private final MerchantWarehouseRelationshipRepository relationshipRepository;
    private final InboundStockRequestRepository inboundRepository;
    private final OutboxService outboxService;
    private final CurrentUserService currentUserService;
    private final OperationsAlertService operationsAlertService;

    public MerchantWarehouseService(
        TenantService tenantService,
        WarehouseService warehouseService,
        WarehouseRepository warehouseRepository,
        InventoryService inventoryService,
        WarehouseInventoryRepository warehouseInventoryRepository,
        MerchantWarehouseRelationshipRepository relationshipRepository,
        InboundStockRequestRepository inboundRepository,
        OutboxService outboxService,
        CurrentUserService currentUserService,
        OperationsAlertService operationsAlertService
    ) {
        this.tenantService = tenantService;
        this.warehouseService = warehouseService;
        this.warehouseRepository = warehouseRepository;
        this.inventoryService = inventoryService;
        this.warehouseInventoryRepository = warehouseInventoryRepository;
        this.relationshipRepository = relationshipRepository;
        this.inboundRepository = inboundRepository;
        this.outboxService = outboxService;
        this.currentUserService = currentUserService;
        this.operationsAlertService = operationsAlertService;
    }

    @Transactional(readOnly = true)
    public List<WarehouseProviderOptionResponse> findWarehouseProviderOptions() {
        if (currentUserService.hasRole(UserRole.WAREHOUSE_OPERATOR) && !currentUserService.isAdmin()) {
            UUID tenantId = currentUserService.required().tenantId();
            return warehouseRepository.findByTenantId(tenantId).stream()
                .map(WarehouseProviderOptionResponse::from)
                .toList();
        }

        return warehouseRepository.findAll().stream()
            .filter(warehouse -> warehouse.getTenant().getType() == TenantType.WAREHOUSE_PROVIDER)
            .map(WarehouseProviderOptionResponse::from)
            .toList();
    }

    @Transactional
    public MerchantWarehouseRelationshipResponse requestRelationship(CreateMerchantWarehouseRelationshipRequest request) {
        currentUserService.requireAdminOrTenant(request.merchantId());
        Tenant merchant = tenantService.getRequired(request.merchantId());
        Tenant warehouseProvider = tenantService.getRequired(request.warehouseProviderId());
        requireTenantType(merchant, TenantType.MERCHANT, "Relationship merchant must be a merchant tenant.");
        requireTenantType(
            warehouseProvider,
            TenantType.WAREHOUSE_PROVIDER,
            "Relationship warehouse provider must be a warehouse provider tenant."
        );
        if (merchant.getId().equals(warehouseProvider.getId())) {
            throw new DomainConflictException("Merchant and warehouse provider must be different tenants.");
        }
        relationshipRepository.findByMerchantIdAndWarehouseProviderId(merchant.getId(), warehouseProvider.getId())
            .ifPresent(existing -> {
                throw new DomainConflictException("Merchant already has a relationship with this warehouse provider.");
            });

        MerchantWarehouseRelationship relationship = new MerchantWarehouseRelationship();
        relationship.setMerchant(merchant);
        relationship.setWarehouseProvider(warehouseProvider);
        relationship.setStatus(MerchantWarehouseRelationshipStatus.REQUESTED);
        relationship.setServiceNotes(trimToNull(request.serviceNotes()));
        MerchantWarehouseRelationship saved = relationshipRepository.saveAndFlush(relationship);
        outboxService.publish(
            "MerchantWarehouseRelationshipRequested",
            "MerchantWarehouseRelationship",
            saved.getId(),
            Map.of(
                "relationshipId", saved.getId().toString(),
                "merchantId", merchant.getId().toString(),
                "warehouseProviderId", warehouseProvider.getId().toString()
            )
        );
        operationsAlertService.recordWarehouseProviderAlert(
            warehouseProvider.getId(),
            "Warehouse service requested",
            merchant.getName() + " requested warehouse service from " + warehouseProvider.getName()
                + ". Review the relationship before inbound work can start.",
            "MerchantWarehouseRelationship",
            saved.getId()
        );
        operationsAlertService.recordPlatformAlert(
            "Relationship request ready",
            merchant.getName() + " requested service from " + warehouseProvider.getName()
                + ". Platform governance can review the relationship record.",
            "MerchantWarehouseRelationship",
            saved.getId()
        );
        return MerchantWarehouseRelationshipResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<MerchantWarehouseRelationshipResponse> findRelationships() {
        if (currentUserService.isAdmin()) {
            return relationshipRepository.findAll().stream()
                .map(MerchantWarehouseRelationshipResponse::from)
                .toList();
        }

        UUID tenantId = currentUserService.required().tenantId();
        if (currentUserService.hasRole(UserRole.MERCHANT)) {
            return relationshipRepository.findByMerchantIdOrderByCreatedAtDesc(tenantId).stream()
                .map(MerchantWarehouseRelationshipResponse::from)
                .toList();
        }

        return relationshipRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream()
            .map(MerchantWarehouseRelationshipResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<MerchantAuthorizedStockResponse> findAuthorizedStock(UUID requestedMerchantId) {
        UUID merchantId = resolveMerchantId(requestedMerchantId);
        Map<UUID, MerchantWarehouseRelationship> activeRelationshipsByProvider = relationshipRepository
            .findByMerchantIdOrderByCreatedAtDesc(merchantId)
            .stream()
            .filter(relationship -> relationship.getStatus() == MerchantWarehouseRelationshipStatus.ACTIVE)
            .collect(Collectors.toMap(
                relationship -> relationship.getWarehouseProvider().getId(),
                relationship -> relationship,
                (left, right) -> left,
                LinkedHashMap::new
            ));

        Map<StockKey, StockAccumulator> rows = new LinkedHashMap<>();
        for (WarehouseInventory inventory : warehouseInventoryRepository.findAuthorizedActiveStockForMerchant(merchantId)) {
            MerchantWarehouseRelationship relationship = activeRelationshipsByProvider.get(
                inventory.getWarehouse().getTenant().getId()
            );
            if (relationship == null) {
                continue;
            }
            StockAccumulator row = row(rows, relationship, inventory.getWarehouse(), inventory.getInventoryItem());
            row.quantity = inventory.getQuantity();
            row.reservedQuantity = inventory.getReservedQuantity();
        }

        for (InboundStockRequest inbound : inboundRepository.findByMerchantIdOrderByCreatedAtDesc(merchantId)) {
            if (inbound.getRelationship().getStatus() != MerchantWarehouseRelationshipStatus.ACTIVE) {
                continue;
            }
            int inboundQuantity = openInboundQuantity(inbound);
            if (inboundQuantity == 0) {
                continue;
            }
            StockAccumulator row = row(rows, inbound.getRelationship(), inbound.getWarehouse(), inbound.getInventoryItem());
            row.inboundQuantity += inboundQuantity;
        }

        return rows.values().stream()
            .map(StockAccumulator::toResponse)
            .toList();
    }

    @Transactional
    public MerchantWarehouseRelationshipResponse activateRelationship(UUID relationshipId) {
        MerchantWarehouseRelationship relationship = getRequiredRelationship(relationshipId);
        currentUserService.requireAdminOrTenant(relationship.getWarehouseProvider().getId());
        if (relationship.getStatus() == MerchantWarehouseRelationshipStatus.ACTIVE) {
            return MerchantWarehouseRelationshipResponse.from(relationship);
        }
        if (relationship.getStatus() != MerchantWarehouseRelationshipStatus.REQUESTED
            && relationship.getStatus() != MerchantWarehouseRelationshipStatus.SUSPENDED) {
            throw new DomainConflictException("Only REQUESTED or SUSPENDED relationships can be activated.");
        }

        relationship.setStatus(MerchantWarehouseRelationshipStatus.ACTIVE);
        relationship.setApprovedAt(Instant.now());
        relationship.setSuspendedAt(null);
        relationship.setStatusReason(null);
        MerchantWarehouseRelationship saved = relationshipRepository.saveAndFlush(relationship);
        outboxService.publish(
            "MerchantWarehouseRelationshipActivated",
            "MerchantWarehouseRelationship",
            saved.getId(),
            Map.of("relationshipId", saved.getId().toString())
        );
        operationsAlertService.recordMerchantAlert(
            relationship.getMerchant().getId(),
            "Warehouse service active",
            relationship.getWarehouseProvider().getName() + " activated service for " + relationship.getMerchant().getName()
                + ". You can now submit inbound stock and allocate warehouse work.",
            "MerchantWarehouseRelationship",
            saved.getId()
        );
        return MerchantWarehouseRelationshipResponse.from(saved);
    }

    @Transactional
    public MerchantWarehouseRelationshipResponse suspendRelationship(UUID relationshipId, String reason) {
        MerchantWarehouseRelationship relationship = getRequiredRelationship(relationshipId);
        if (!currentUserService.canMutatePlatform()) {
            throw new DomainConflictException("Only owner/admin users can suspend merchant-warehouse relationships.");
        }
        if (relationship.getStatus() != MerchantWarehouseRelationshipStatus.ACTIVE) {
            throw new DomainConflictException("Only ACTIVE relationships can be suspended.");
        }
        relationship.setStatus(MerchantWarehouseRelationshipStatus.SUSPENDED);
        relationship.setSuspendedAt(Instant.now());
        relationship.setStatusReason(trimToNull(reason));
        MerchantWarehouseRelationship saved = relationshipRepository.saveAndFlush(relationship);
        outboxService.publish(
            "MerchantWarehouseRelationshipSuspended",
            "MerchantWarehouseRelationship",
            saved.getId(),
            Map.of("relationshipId", saved.getId().toString())
        );
        return MerchantWarehouseRelationshipResponse.from(saved);
    }

    @Transactional
    public MerchantWarehouseRelationshipResponse reactivateRelationship(UUID relationshipId, String reason) {
        MerchantWarehouseRelationship relationship = getRequiredRelationship(relationshipId);
        if (!currentUserService.canMutatePlatform()) {
            throw new DomainConflictException("Only owner/admin users can reactivate merchant-warehouse relationships.");
        }
        if (relationship.getStatus() != MerchantWarehouseRelationshipStatus.SUSPENDED) {
            throw new DomainConflictException("Only SUSPENDED relationships can be reactivated.");
        }
        relationship.setStatus(MerchantWarehouseRelationshipStatus.ACTIVE);
        relationship.setSuspendedAt(null);
        relationship.setStatusReason(trimToNull(reason));
        MerchantWarehouseRelationship saved = relationshipRepository.saveAndFlush(relationship);
        outboxService.publish(
            "MerchantWarehouseRelationshipReactivated",
            "MerchantWarehouseRelationship",
            saved.getId(),
            Map.of("relationshipId", saved.getId().toString())
        );
        return MerchantWarehouseRelationshipResponse.from(saved);
    }

    @Transactional
    public MerchantWarehouseRelationshipResponse endRelationship(UUID relationshipId, String reason) {
        MerchantWarehouseRelationship relationship = getRequiredRelationship(relationshipId);
        if (!currentUserService.canMutatePlatform()) {
            throw new DomainConflictException("Only owner/admin users can end merchant-warehouse relationships.");
        }
        if (relationship.getStatus() == MerchantWarehouseRelationshipStatus.ENDED) {
            return MerchantWarehouseRelationshipResponse.from(relationship);
        }
        relationship.setStatus(MerchantWarehouseRelationshipStatus.ENDED);
        relationship.setEndedAt(Instant.now());
        relationship.setStatusReason(trimToNull(reason));
        MerchantWarehouseRelationship saved = relationshipRepository.saveAndFlush(relationship);
        outboxService.publish(
            "MerchantWarehouseRelationshipEnded",
            "MerchantWarehouseRelationship",
            saved.getId(),
            Map.of("relationshipId", saved.getId().toString())
        );
        return MerchantWarehouseRelationshipResponse.from(saved);
    }

    @Transactional
    public InboundStockRequestResponse submitInboundStock(CreateInboundStockRequest request) {
        return createInboundStock(request, InboundStockRequestStatus.SUBMITTED, "InboundStockSubmitted");
    }

    @Transactional
    public InboundStockRequestResponse createInboundDraft(CreateInboundStockRequest request) {
        return createInboundStock(request, InboundStockRequestStatus.DRAFT, "InboundStockDraftCreated");
    }

    private InboundStockRequestResponse createInboundStock(
        CreateInboundStockRequest request,
        InboundStockRequestStatus status,
        String eventType
    ) {
        MerchantWarehouseRelationship relationship = getRequiredRelationship(request.relationshipId());
        currentUserService.requireAdminOrTenant(relationship.getMerchant().getId());
        if (relationship.getStatus() != MerchantWarehouseRelationshipStatus.ACTIVE) {
            throw new DomainConflictException("Inbound stock requires an active merchant-warehouse relationship.");
        }

        Warehouse warehouse = warehouseService.getRequired(request.warehouseId());
        if (!warehouse.getTenant().getId().equals(relationship.getWarehouseProvider().getId())) {
            throw new DomainConflictException("Warehouse does not belong to the relationship warehouse provider.");
        }

        InventoryItem item = inventoryService.getRequiredItem(request.inventoryItemId());
        if (!item.getMerchant().getId().equals(relationship.getMerchant().getId())) {
            throw new DomainConflictException("Inventory item does not belong to the relationship merchant.");
        }

        InboundStockRequest inbound = new InboundStockRequest();
        inbound.setRelationship(relationship);
        inbound.setMerchant(relationship.getMerchant());
        inbound.setWarehouseProvider(relationship.getWarehouseProvider());
        inbound.setWarehouse(warehouse);
        inbound.setInventoryItem(item);
        inbound.setRequestedQuantity(request.requestedQuantity());
        inbound.setStatus(status);
        inbound.setMerchantReference(trimToNull(request.merchantReference()));
        inbound.setMerchantNote(trimToNull(request.merchantNote()));
        InboundStockRequest saved = inboundRepository.saveAndFlush(inbound);
        outboxService.publish(
            eventType,
            "InboundStockRequest",
            saved.getId(),
            Map.of(
                "inboundStockRequestId", saved.getId().toString(),
                "relationshipId", relationship.getId().toString(),
                "warehouseId", warehouse.getId().toString(),
                "inventoryItemId", item.getId().toString(),
                "requestedQuantity", request.requestedQuantity(),
                "status", status.name()
            )
        );
        if (status == InboundStockRequestStatus.SUBMITTED) {
            operationsAlertService.recordWarehouseProviderAlert(
                relationship.getWarehouseProvider().getId(),
                "Inbound stock needs review",
                relationship.getMerchant().getName() + " submitted " + request.requestedQuantity()
                    + " units of " + item.getSku() + " to " + warehouse.getName()
                    + ". Approve the inbound request to start receiving.",
                "InboundStockRequest",
                saved.getId()
            );
        }
        return InboundStockRequestResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<InboundStockRequestResponse> findInboundStockRequests() {
        if (currentUserService.isAdmin()) {
            return inboundRepository.findAll().stream()
                .map(InboundStockRequestResponse::from)
                .toList();
        }

        UUID tenantId = currentUserService.required().tenantId();
        if (currentUserService.hasRole(UserRole.MERCHANT)) {
            return inboundRepository.findByMerchantIdOrderByCreatedAtDesc(tenantId).stream()
                .map(InboundStockRequestResponse::from)
                .toList();
        }

        return inboundRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream()
            .map(InboundStockRequestResponse::from)
            .toList();
    }

    @Transactional
    public InboundStockRequestResponse submitInboundDraft(UUID inboundStockRequestId) {
        InboundStockRequest inbound = getRequiredInbound(inboundStockRequestId);
        currentUserService.requireAdminOrTenant(inbound.getMerchant().getId());
        if (inbound.getStatus() != InboundStockRequestStatus.DRAFT) {
            throw new DomainConflictException("Only DRAFT inbound stock can be submitted.");
        }

        inbound.setStatus(InboundStockRequestStatus.SUBMITTED);
        InboundStockRequest saved = inboundRepository.saveAndFlush(inbound);
        outboxService.publish(
            "InboundStockSubmitted",
            "InboundStockRequest",
            saved.getId(),
            Map.of("inboundStockRequestId", saved.getId().toString())
        );
        operationsAlertService.recordWarehouseProviderAlert(
            inbound.getWarehouseProvider().getId(),
            "Inbound stock needs review",
            inbound.getMerchant().getName() + " submitted " + inbound.getRequestedQuantity()
                + " units of " + inbound.getInventoryItem().getSku() + " to " + inbound.getWarehouse().getName()
                + ". Approve the inbound request to start receiving.",
            "InboundStockRequest",
            saved.getId()
        );
        return InboundStockRequestResponse.from(saved);
    }

    @Transactional
    public InboundStockRequestResponse approveInboundStock(UUID inboundStockRequestId) {
        InboundStockRequest inbound = getRequiredInbound(inboundStockRequestId);
        requireWarehouseProviderAccess(inbound);
        if (inbound.getStatus() != InboundStockRequestStatus.SUBMITTED) {
            throw new DomainConflictException("Only SUBMITTED inbound stock can be approved.");
        }

        inbound.setStatus(InboundStockRequestStatus.APPROVED);
        InboundStockRequest saved = inboundRepository.saveAndFlush(inbound);
        outboxService.publish(
            "InboundStockApproved",
            "InboundStockRequest",
            saved.getId(),
            Map.of("inboundStockRequestId", saved.getId().toString())
        );
        operationsAlertService.recordMerchantAlert(
            inbound.getMerchant().getId(),
            "Inbound stock approved",
            inbound.getWarehouseProvider().getName() + " approved " + inbound.getRequestedQuantity()
                + " units of " + inbound.getInventoryItem().getSku() + " for receiving at "
                + inbound.getWarehouse().getName() + ".",
            "InboundStockRequest",
            saved.getId()
        );
        return InboundStockRequestResponse.from(saved);
    }

    @Transactional
    public InboundStockRequestResponse cancelInboundStock(UUID inboundStockRequestId) {
        InboundStockRequest inbound = getRequiredInbound(inboundStockRequestId);
        currentUserService.requireAdminOrTenant(inbound.getMerchant().getId());
        if (inbound.getStatus() != InboundStockRequestStatus.DRAFT
            && inbound.getStatus() != InboundStockRequestStatus.SUBMITTED
            && inbound.getStatus() != InboundStockRequestStatus.APPROVED) {
            throw new DomainConflictException("Only DRAFT, SUBMITTED, or APPROVED inbound stock can be cancelled.");
        }

        inbound.setStatus(InboundStockRequestStatus.CANCELLED);
        InboundStockRequest saved = inboundRepository.saveAndFlush(inbound);
        outboxService.publish(
            "InboundStockCancelled",
            "InboundStockRequest",
            saved.getId(),
            Map.of("inboundStockRequestId", saved.getId().toString())
        );
        operationsAlertService.recordWarehouseProviderAlert(
            inbound.getWarehouseProvider().getId(),
            "Inbound stock cancelled",
            inbound.getMerchant().getName() + " cancelled the inbound request for "
                + inbound.getInventoryItem().getSku() + ". No warehouse receiving action is needed.",
            "InboundStockRequest",
            saved.getId()
        );
        return InboundStockRequestResponse.from(saved);
    }

    @Transactional
    public InboundStockRequestResponse startReceiving(UUID inboundStockRequestId) {
        InboundStockRequest inbound = getRequiredInbound(inboundStockRequestId);
        requireWarehouseProviderAccess(inbound);
        if (inbound.getStatus() != InboundStockRequestStatus.APPROVED) {
            throw new DomainConflictException("Only APPROVED inbound stock can move to RECEIVING.");
        }

        inbound.setStatus(InboundStockRequestStatus.RECEIVING);
        InboundStockRequest saved = inboundRepository.saveAndFlush(inbound);
        outboxService.publish(
            "InboundStockReceivingStarted",
            "InboundStockRequest",
            saved.getId(),
            Map.of("inboundStockRequestId", saved.getId().toString())
        );
        operationsAlertService.recordMerchantAlert(
            inbound.getMerchant().getId(),
            "Inbound receiving started",
            inbound.getWarehouseProvider().getName() + " started receiving " + inbound.getInventoryItem().getSku()
                + " at " + inbound.getWarehouse().getName() + ".",
            "InboundStockRequest",
            saved.getId()
        );
        return InboundStockRequestResponse.from(saved);
    }

    @Transactional
    public InboundStockRequestResponse receiveInboundStock(UUID inboundStockRequestId, ReceiveInboundStockRequest request) {
        InboundStockRequest inbound = getRequiredInbound(inboundStockRequestId);
        requireWarehouseProviderAccess(inbound);
        if (inbound.getStatus() != InboundStockRequestStatus.APPROVED
            && inbound.getStatus() != InboundStockRequestStatus.RECEIVING) {
            throw new DomainConflictException("Only APPROVED or RECEIVING inbound stock can be received.");
        }
        if (request.receivedQuantity() == 0 && request.damagedQuantity() == 0) {
            throw new DomainConflictException("Received or damaged quantity must be greater than zero.");
        }
        if (request.receivedQuantity() + request.damagedQuantity() > inbound.getRequestedQuantity()) {
            throw new DomainConflictException("Received plus damaged quantity cannot exceed requested quantity.");
        }

        inbound.setReceivedQuantity(request.receivedQuantity());
        inbound.setDamagedQuantity(request.damagedQuantity());
        inbound.setReceivingNote(trimToNull(request.receivingNote()));
        inbound.setStatus(InboundStockRequestStatus.RECEIVED);
        inbound.setReceivedAt(Instant.now());
        if (request.receivedQuantity() > 0) {
            inventoryService.receiveStock(inbound.getWarehouse(), inbound.getInventoryItem(), request.receivedQuantity());
        }

        InboundStockRequest saved = inboundRepository.saveAndFlush(inbound);
        outboxService.publish(
            "InboundStockReceived",
            "InboundStockRequest",
            saved.getId(),
            Map.of(
                "inboundStockRequestId", saved.getId().toString(),
                "receivedQuantity", request.receivedQuantity(),
                "damagedQuantity", request.damagedQuantity()
            )
        );
        operationsAlertService.recordMerchantAlert(
            inbound.getMerchant().getId(),
            "Inbound stock received",
            inbound.getWarehouseProvider().getName() + " received " + request.receivedQuantity()
                + " units of " + inbound.getInventoryItem().getSku() + " at " + inbound.getWarehouse().getName()
                + damagedText(request.damagedQuantity()) + ".",
            "InboundStockRequest",
            saved.getId()
        );
        return InboundStockRequestResponse.from(saved);
    }

    @Transactional
    public InboundStockRequestResponse rejectInboundStock(UUID inboundStockRequestId, RejectInboundStockRequest request) {
        InboundStockRequest inbound = getRequiredInbound(inboundStockRequestId);
        requireWarehouseProviderAccess(inbound);
        if (inbound.getStatus() != InboundStockRequestStatus.SUBMITTED
            && inbound.getStatus() != InboundStockRequestStatus.APPROVED
            && inbound.getStatus() != InboundStockRequestStatus.RECEIVING) {
            throw new DomainConflictException("Only SUBMITTED, APPROVED, or RECEIVING inbound stock can be rejected.");
        }

        inbound.setStatus(InboundStockRequestStatus.REJECTED);
        inbound.setRejectionReason(request.rejectionReason().trim());
        InboundStockRequest saved = inboundRepository.saveAndFlush(inbound);
        outboxService.publish(
            "InboundStockRejected",
            "InboundStockRequest",
            saved.getId(),
            Map.of("inboundStockRequestId", saved.getId().toString())
        );
        operationsAlertService.recordMerchantAlert(
            inbound.getMerchant().getId(),
            "Inbound stock rejected",
            inbound.getWarehouseProvider().getName() + " rejected the inbound request for "
                + inbound.getInventoryItem().getSku() + ": " + request.rejectionReason().trim(),
            "InboundStockRequest",
            saved.getId()
        );
        return InboundStockRequestResponse.from(saved);
    }

    private MerchantWarehouseRelationship getRequiredRelationship(UUID relationshipId) {
        return relationshipRepository.findWithDetailsById(relationshipId)
            .orElseThrow(() -> new ResourceNotFoundException("Merchant-warehouse relationship not found: " + relationshipId));
    }

    private InboundStockRequest getRequiredInbound(UUID inboundStockRequestId) {
        return inboundRepository.findWithDetailsById(inboundStockRequestId)
            .orElseThrow(() -> new ResourceNotFoundException("Inbound stock request not found: " + inboundStockRequestId));
    }

    private UUID resolveMerchantId(UUID requestedMerchantId) {
        if (currentUserService.isAdmin()) {
            if (requestedMerchantId == null) {
                throw new DomainConflictException("Admin requests for authorized stock must include merchantId.");
            }
            Tenant merchant = tenantService.getRequired(requestedMerchantId);
            requireTenantType(merchant, TenantType.MERCHANT, "Authorized stock merchant must be a merchant tenant.");
            return merchant.getId();
        }
        UUID tenantId = currentUserService.required().tenantId();
        if (requestedMerchantId != null && !requestedMerchantId.equals(tenantId)) {
            currentUserService.requireAdminOrTenant(requestedMerchantId);
        }
        return tenantId;
    }

    private int openInboundQuantity(InboundStockRequest inbound) {
        if (inbound.getStatus() != InboundStockRequestStatus.SUBMITTED
            && inbound.getStatus() != InboundStockRequestStatus.APPROVED
            && inbound.getStatus() != InboundStockRequestStatus.RECEIVING) {
            return 0;
        }
        return Math.max(0, inbound.getRequestedQuantity() - inbound.getReceivedQuantity() - inbound.getDamagedQuantity());
    }

    private StockAccumulator row(
        Map<StockKey, StockAccumulator> rows,
        MerchantWarehouseRelationship relationship,
        Warehouse warehouse,
        InventoryItem item
    ) {
        StockKey key = new StockKey(relationship.getId(), warehouse.getId(), item.getId());
        return rows.computeIfAbsent(key, ignored -> new StockAccumulator(relationship, warehouse, item));
    }

    private void requireWarehouseProviderAccess(InboundStockRequest inbound) {
        currentUserService.requireAdminOrTenant(inbound.getWarehouseProvider().getId());
    }

    private void requireTenantType(Tenant tenant, TenantType type, String message) {
        if (tenant.getType() != type) {
            throw new DomainConflictException(message);
        }
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String damagedText(int damagedQuantity) {
        if (damagedQuantity <= 0) {
            return "";
        }
        return " with " + damagedQuantity + " damaged";
    }

    private record StockKey(UUID relationshipId, UUID warehouseId, UUID inventoryItemId) {
    }

    private static class StockAccumulator {
        private final MerchantWarehouseRelationship relationship;
        private final Warehouse warehouse;
        private final InventoryItem item;
        private int quantity;
        private int reservedQuantity;
        private int inboundQuantity;

        private StockAccumulator(MerchantWarehouseRelationship relationship, Warehouse warehouse, InventoryItem item) {
            this.relationship = relationship;
            this.warehouse = warehouse;
            this.item = item;
        }

        private MerchantAuthorizedStockResponse toResponse() {
            return new MerchantAuthorizedStockResponse(
                relationship.getId(),
                relationship.getMerchant().getId(),
                relationship.getMerchant().getName(),
                relationship.getWarehouseProvider().getId(),
                relationship.getWarehouseProvider().getName(),
                warehouse.getId(),
                warehouse.getName(),
                item.getId(),
                item.getSku(),
                item.getName(),
                quantity,
                reservedQuantity,
                quantity - reservedQuantity,
                inboundQuantity
            );
        }
    }
}
