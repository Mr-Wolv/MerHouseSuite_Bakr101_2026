package com.merhouse.service;

import com.merhouse.dto.CreateShipmentRequest;
import com.merhouse.dto.FulfillmentAllocationResponse;
import com.merhouse.dto.FulfillmentExceptionResponse;
import com.merhouse.dto.ReportExceptionRequest;
import com.merhouse.dto.ResolveExceptionRequest;
import com.merhouse.dto.ShipmentResponse;
import com.merhouse.dto.UpdateAllocationWorkloadRequest;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.CustomerOrder;
import com.merhouse.entity.FulfillmentException;
import com.merhouse.entity.FulfillmentAllocation;
import com.merhouse.entity.FulfillmentStatus;
import com.merhouse.entity.MerchantWarehouseRelationship;
import com.merhouse.entity.MerchantWarehouseRelationshipStatus;
import com.merhouse.entity.OrderStatus;
import com.merhouse.entity.Shipment;
import com.merhouse.entity.ShipmentPackage;
import com.merhouse.entity.ShipmentPackageEvent;
import com.merhouse.entity.ShipmentStatus;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.CustomerOrderRepository;
import com.merhouse.repository.FulfillmentAllocationRepository;
import com.merhouse.repository.FulfillmentExceptionRepository;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.MerchantWarehouseRelationshipRepository;
import com.merhouse.repository.ShipmentRepository;
import com.merhouse.repository.ShipmentPackageRepository;
import com.merhouse.security.UserPrincipal;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FulfillmentService {
    private static final Map<FulfillmentStatus, Set<FulfillmentStatus>> ALLOWED_ALLOCATION_TRANSITIONS =
        new EnumMap<>(FulfillmentStatus.class);
    private static final Set<String> SUPPORTED_CARRIERS = Set.of("Local Carrier", "DHL", "FedEx", "UPS", "Aramex");

    static {
        ALLOWED_ALLOCATION_TRANSITIONS.put(FulfillmentStatus.PENDING, Set.of(FulfillmentStatus.PICKING, FulfillmentStatus.CANCELLED));
        ALLOWED_ALLOCATION_TRANSITIONS.put(FulfillmentStatus.PICKING, Set.of(FulfillmentStatus.PACKED, FulfillmentStatus.CANCELLED));
        ALLOWED_ALLOCATION_TRANSITIONS.put(FulfillmentStatus.PACKED, Set.of(FulfillmentStatus.SHIPPED));
        ALLOWED_ALLOCATION_TRANSITIONS.put(FulfillmentStatus.SHIPPED, Set.of());
        ALLOWED_ALLOCATION_TRANSITIONS.put(FulfillmentStatus.CANCELLED, Set.of());
    }

    private final FulfillmentAllocationRepository allocationRepository;
    private final MerchantWarehouseRelationshipRepository relationshipRepository;
    private final ShipmentRepository shipmentRepository;
    private final ShipmentPackageRepository shipmentPackageRepository;
    private final FulfillmentExceptionRepository exceptionRepository;
    private final AppUserRepository appUserRepository;
    private final CustomerOrderRepository orderRepository;
    private final OutboxService outboxService;
    private final CurrentUserService currentUserService;
    private final Clock clock;

    public FulfillmentService(
        FulfillmentAllocationRepository allocationRepository,
        MerchantWarehouseRelationshipRepository relationshipRepository,
        ShipmentRepository shipmentRepository,
        ShipmentPackageRepository shipmentPackageRepository,
        FulfillmentExceptionRepository exceptionRepository,
        AppUserRepository appUserRepository,
        CustomerOrderRepository orderRepository,
        OutboxService outboxService,
        CurrentUserService currentUserService,
        Clock clock
    ) {
        this.allocationRepository = allocationRepository;
        this.relationshipRepository = relationshipRepository;
        this.shipmentRepository = shipmentRepository;
        this.shipmentPackageRepository = shipmentPackageRepository;
        this.exceptionRepository = exceptionRepository;
        this.appUserRepository = appUserRepository;
        this.orderRepository = orderRepository;
        this.outboxService = outboxService;
        this.currentUserService = currentUserService;
        this.clock = clock;
    }

    @Transactional
    public FulfillmentAllocationResponse advanceAllocation(UUID allocationId, FulfillmentStatus nextStatus) {
        FulfillmentAllocation allocation = getRequiredAllocation(allocationId);
        currentUserService.requireAdminOrTenant(allocation.getWarehouse().getTenant().getId());
        FulfillmentStatus currentStatus = allocation.getStatus();
        if (!ALLOWED_ALLOCATION_TRANSITIONS.getOrDefault(currentStatus, Set.of()).contains(nextStatus)) {
            throw new DomainConflictException("Invalid allocation transition: " + currentStatus + " -> " + nextStatus);
        }
        if (nextStatus == FulfillmentStatus.CANCELLED) {
            throw new DomainConflictException("Cancel the order instead of directly cancelling the allocation.");
        }
        if (nextStatus == FulfillmentStatus.SHIPPED) {
            throw new DomainConflictException("Create a shipment to move an allocation to SHIPPED.");
        }

        allocation.setStatus(nextStatus);
        FulfillmentAllocation saved = allocationRepository.saveAndFlush(allocation);
        outboxService.publish(
            "FulfillmentAllocationAdvanced",
            "FulfillmentAllocation",
            saved.getId(),
            Map.of("allocationId", saved.getId().toString(), "status", saved.getStatus().name())
        );
        return response(saved);
    }

    @Transactional(readOnly = true)
    public List<FulfillmentAllocationResponse> findAllocations(UUID warehouseId) {
        if (warehouseId != null) {
            return allocationRepository.findByWarehouseIdOrderByCreatedAtDesc(warehouseId).stream()
                .peek(allocation -> currentUserService.requireAdminOrTenant(allocation.getWarehouse().getTenant().getId()))
                .map(this::response)
                .toList();
        }

        if (currentUserService.isAdmin()) {
            return allocationRepository.findAll().stream()
                .map(allocation -> response(getRequiredAllocation(allocation.getId())))
                .toList();
        }

        UUID tenantId = currentUserService.required().tenantId();
        return allocationRepository.findByWarehouseTenantIdOrderByCreatedAtDesc(tenantId).stream()
            .map(this::response)
            .toList();
    }

    @Transactional
    public ShipmentResponse createShipment(CreateShipmentRequest request) {
        FulfillmentAllocation allocation = getRequiredAllocation(request.allocationId());
        currentUserService.requireAdminOrTenant(allocation.getWarehouse().getTenant().getId());
        if (allocation.getStatus() != FulfillmentStatus.PACKED) {
            throw new DomainConflictException("Shipments can only be created for PACKED allocations.");
        }
        if (shipmentRepository.existsByAllocationId(allocation.getId())) {
            throw new DomainConflictException("Allocation already has a shipment.");
        }
        String carrier = request.carrier().trim();
        if (!SUPPORTED_CARRIERS.contains(carrier)) {
            throw new DomainConflictException("Unsupported carrier: " + carrier);
        }
        UserPrincipal actor = currentUserService.required();

        Shipment shipment = new Shipment();
        shipment.setAllocation(allocation);
        shipment.setCarrier(carrier);
        shipment.setTrackingNumber(request.trackingNumber().trim());
        shipment.setMetadata(shipmentMetadata(request, actor));
        shipment.setStatus(ShipmentStatus.IN_TRANSIT);
        addShipmentPackages(shipment, request);

        allocation.setStatus(FulfillmentStatus.SHIPPED);
        CustomerOrder order = allocation.getOrder();
        order.setStatus(OrderStatus.SHIPPED);

        orderRepository.save(order);
        allocationRepository.save(allocation);
        Shipment saved = shipmentRepository.saveAndFlush(shipment);
        outboxService.publish(
            "ShipmentCreated",
            "Shipment",
            saved.getId(),
            Map.of(
                "shipmentId", saved.getId().toString(),
                "allocationId", allocation.getId().toString(),
                "orderId", order.getId().toString(),
                "carrier", saved.getCarrier(),
                "trackingNumber", saved.getTrackingNumber(),
                "packageCount", request.packageCount(),
                "packageWeightKg", request.packageWeightKg().toPlainString(),
                "serviceScope", "PICK_PACK_SHIP"
            )
        );
        return ShipmentResponse.from(saved);
    }

    @Transactional
    public FulfillmentAllocationResponse updateWorkload(UUID allocationId, UpdateAllocationWorkloadRequest request) {
        FulfillmentAllocation allocation = getRequiredAllocation(allocationId);
        currentUserService.requireAdminOrTenant(allocation.getWarehouse().getTenant().getId());
        if (request.assignedUserId() != null) {
            AppUser assigned = appUserRepository.findById(request.assignedUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Assigned user not found: " + request.assignedUserId()));
            if (!assigned.getTenant().getId().equals(allocation.getWarehouse().getTenant().getId())) {
                throw new DomainConflictException("Assigned user must belong to the allocation warehouse provider.");
            }
            allocation.setAssignedUser(assigned);
        }
        if (request.priority() != null) {
            allocation.setPriority(request.priority());
        }
        if (request.scanCode() != null && !request.scanCode().isBlank()) {
            allocation.setScanCode(request.scanCode().trim());
        }
        if (Boolean.TRUE.equals(request.markPickSheetPrinted())) {
            allocation.setPickSheetPrintedAt(clock.instant());
        }
        FulfillmentAllocation saved = allocationRepository.saveAndFlush(allocation);
        outboxService.publish(
            "FulfillmentWorkloadUpdated",
            "FulfillmentAllocation",
            saved.getId(),
            Map.of("allocationId", saved.getId().toString(), "priority", saved.getPriority())
        );
        return response(saved);
    }

    @Transactional(readOnly = true)
    public List<com.merhouse.dto.ShipmentPackageResponse> findPackages(UUID shipmentId) {
        Shipment shipment = shipmentRepository.findWithDetailsById(shipmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Shipment not found: " + shipmentId));
        currentUserService.requireAdminOrTenant(shipment.getAllocation().getWarehouse().getTenant().getId());
        return shipmentPackageRepository.findByShipmentIdOrderByPackageNumber(shipmentId).stream()
            .map(com.merhouse.dto.ShipmentPackageResponse::from)
            .toList();
    }

    @Transactional
    public FulfillmentExceptionResponse reportException(ReportExceptionRequest request) {
        if (request.allocationId() == null && request.shipmentId() == null) {
            throw new DomainConflictException("Exception requires an allocationId or shipmentId.");
        }
        FulfillmentAllocation allocation = request.allocationId() == null ? null : getRequiredAllocation(request.allocationId());
        Shipment shipment = null;
        if (request.shipmentId() != null) {
            shipment = shipmentRepository.findWithDetailsById(request.shipmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Shipment not found: " + request.shipmentId()));
            allocation = shipment.getAllocation();
        }
        currentUserService.requireAdminOrTenant(allocation.getWarehouse().getTenant().getId());

        FulfillmentException exception = new FulfillmentException();
        exception.setAllocation(allocation);
        exception.setShipment(shipment);
        exception.setMerchant(allocation.getOrder().getMerchant());
        exception.setWarehouseProvider(allocation.getWarehouse().getTenant());
        exception.setReasonCode(request.reasonCode().trim());
        exception.setDescription(request.description().trim());
        exception.setStatus("OPEN");
        FulfillmentException saved = exceptionRepository.saveAndFlush(exception);
        outboxService.publish(
            "FulfillmentExceptionReported",
            "FulfillmentException",
            saved.getId(),
            Map.of("exceptionId", saved.getId().toString(), "reasonCode", saved.getReasonCode())
        );
        return FulfillmentExceptionResponse.from(saved);
    }

    @Transactional
    public FulfillmentExceptionResponse resolveException(UUID exceptionId, ResolveExceptionRequest request) {
        FulfillmentException exception = exceptionRepository.findById(exceptionId)
            .orElseThrow(() -> new ResourceNotFoundException("Fulfillment exception not found: " + exceptionId));
        currentUserService.requireAdminOrTenant(exception.getMerchant().getId());
        if (!"OPEN".equals(exception.getStatus())) {
            throw new DomainConflictException("Only OPEN exceptions can be resolved.");
        }
        exception.setStatus("RESOLVED");
        exception.setResolutionNote(request.resolutionNote().trim());
        exception.setResolvedAt(clock.instant());
        FulfillmentException saved = exceptionRepository.saveAndFlush(exception);
        outboxService.publish(
            "FulfillmentExceptionResolved",
            "FulfillmentException",
            saved.getId(),
            Map.of("exceptionId", saved.getId().toString())
        );
        return FulfillmentExceptionResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<FulfillmentExceptionResponse> findExceptions() {
        if (currentUserService.isAdmin()) {
            return exceptionRepository.findAll().stream().map(FulfillmentExceptionResponse::from).toList();
        }
        UUID tenantId = currentUserService.required().tenantId();
        if (currentUserService.hasRole(com.merhouse.entity.UserRole.MERCHANT)) {
            return exceptionRepository.findByMerchantIdOrderByCreatedAtDesc(tenantId).stream()
                .map(FulfillmentExceptionResponse::from)
                .toList();
        }
        return exceptionRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream()
            .map(FulfillmentExceptionResponse::from)
            .toList();
    }

    @Transactional
    public ShipmentResponse markDelivered(UUID shipmentId) {
        return advanceShipment(shipmentId, ShipmentStatus.DELIVERED);
    }

    @Transactional
    public ShipmentResponse advanceShipment(UUID shipmentId, ShipmentStatus nextStatus) {
        Shipment shipment = shipmentRepository.findWithDetailsById(shipmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Shipment not found: " + shipmentId));
        currentUserService.requireAdminOrTenant(shipment.getAllocation().getWarehouse().getTenant().getId());
        if (shipment.getStatus() != ShipmentStatus.IN_TRANSIT) {
            throw new DomainConflictException("Only IN_TRANSIT shipments can change status.");
        }
        if (nextStatus == ShipmentStatus.IN_TRANSIT) {
            throw new DomainConflictException("Shipment is already in transit.");
        }

        shipment.setStatus(nextStatus);
        if (nextStatus == ShipmentStatus.DELIVERED) {
            shipment.getAllocation().getOrder().setStatus(OrderStatus.DELIVERED);
            orderRepository.save(shipment.getAllocation().getOrder());
        }
        Shipment saved = shipmentRepository.saveAndFlush(shipment);
        outboxService.publish(
            "Shipment" + nextStatus.name().charAt(0) + nextStatus.name().substring(1).toLowerCase(),
            "Shipment",
            saved.getId(),
            Map.of(
                "shipmentId", saved.getId().toString(),
                "orderId", shipment.getAllocation().getOrder().getId().toString(),
                "status", nextStatus.name(),
                "carrier", saved.getCarrier(),
                "trackingNumber", saved.getTrackingNumber()
            )
        );
        return ShipmentResponse.from(saved);
    }

    private FulfillmentAllocation getRequiredAllocation(UUID allocationId) {
        return allocationRepository.findWithDetailsById(allocationId)
            .orElseThrow(() -> new ResourceNotFoundException("Fulfillment allocation not found: " + allocationId));
    }

    private FulfillmentAllocationResponse response(FulfillmentAllocation allocation) {
        MerchantWarehouseRelationship relationship = relationshipRepository
            .findByMerchantIdAndWarehouseProviderIdAndStatus(
                allocation.getOrder().getMerchant().getId(),
                allocation.getWarehouse().getTenant().getId(),
                MerchantWarehouseRelationshipStatus.ACTIVE
            )
            .orElse(null);
        return FulfillmentAllocationResponse.from(allocation, relationship);
    }

    private Map<String, Object> shipmentMetadata(CreateShipmentRequest request, UserPrincipal actor) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (request.metadata() != null) {
            metadata.putAll(request.metadata());
        }
        metadata.put("source", metadata.getOrDefault("source", "warehouse-console"));
        metadata.put("serviceScope", "PICK_PACK_SHIP");
        metadata.put("packageCount", request.packageCount());
        metadata.put("packageWeightKg", request.packageWeightKg());
        metadata.put("packageLengthCm", request.packageLengthCm());
        metadata.put("packageWidthCm", request.packageWidthCm());
        metadata.put("packageHeightCm", request.packageHeightCm());
        metadata.put("packingNote", request.packingNote().trim());
        metadata.put("shippedByUserId", actor.id().toString());
        metadata.put("shippedAt", clock.instant().toString());
        return metadata;
    }

    private void addShipmentPackages(Shipment shipment, CreateShipmentRequest request) {
        BigDecimal perPackageWeight = request.packageWeightKg().divide(BigDecimal.valueOf(request.packageCount()), 3, java.math.RoundingMode.HALF_UP);
        for (int index = 1; index <= request.packageCount(); index++) {
            ShipmentPackage shipmentPackage = new ShipmentPackage();
            shipmentPackage.setPackageNumber(index);
            shipmentPackage.setLabelCode(request.trackingNumber().trim() + "-PKG-" + index);
            shipmentPackage.setWeightKg(perPackageWeight);
            shipmentPackage.setLengthCm(request.packageLengthCm());
            shipmentPackage.setWidthCm(request.packageWidthCm());
            shipmentPackage.setHeightCm(request.packageHeightCm());
            shipmentPackage.setStatus("HANDED_OFF");
            ShipmentPackageEvent packed = new ShipmentPackageEvent();
            packed.setEventType("PACKED");
            packed.setNote(request.packingNote().trim());
            shipmentPackage.addEvent(packed);
            ShipmentPackageEvent handedOff = new ShipmentPackageEvent();
            handedOff.setEventType("HANDED_OFF");
            handedOff.setNote("Carrier handoff recorded for " + request.carrier().trim());
            shipmentPackage.addEvent(handedOff);
            shipment.addPackage(shipmentPackage);
        }
    }
}
