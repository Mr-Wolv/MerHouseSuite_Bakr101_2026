package com.merhouse.service;

import com.merhouse.dto.CarrierDispatchResponse;
import com.merhouse.dto.FulfillmentAllocationDetailResponse;
import com.merhouse.dto.FulfillmentAllocationResponse;
import com.merhouse.dto.InboundStockRequestDetailResponse;
import com.merhouse.dto.InboundStockRequestResponse;
import com.merhouse.dto.InventoryAuditLogResponse;
import com.merhouse.dto.InventoryItemDetailResponse;
import com.merhouse.dto.InventoryItemResponse;
import com.merhouse.dto.MerchantWarehouseRelationshipDetailResponse;
import com.merhouse.dto.MerchantWarehouseRelationshipResponse;
import com.merhouse.dto.OrderDetailResponse;
import com.merhouse.dto.OrderResponse;
import com.merhouse.dto.OutboxEventResponse;
import com.merhouse.dto.ShipmentDetailResponse;
import com.merhouse.dto.ShipmentResponse;
import com.merhouse.dto.TimelineEventResponse;
import com.merhouse.entity.BackorderItem;
import com.merhouse.entity.CarrierDispatch;
import com.merhouse.entity.CustomerOrder;
import com.merhouse.entity.FulfillmentAllocation;
import com.merhouse.entity.InboundStockRequest;
import com.merhouse.entity.InventoryAuditLog;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.MerchantWarehouseRelationship;
import com.merhouse.entity.OutboxEvent;
import com.merhouse.entity.Shipment;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.CarrierDispatchRepository;
import com.merhouse.repository.CustomerOrderRepository;
import com.merhouse.repository.FulfillmentAllocationRepository;
import com.merhouse.repository.InboundStockRequestRepository;
import com.merhouse.repository.InventoryAuditLogRepository;
import com.merhouse.repository.InventoryItemRepository;
import com.merhouse.repository.MerchantWarehouseRelationshipRepository;
import com.merhouse.repository.OutboxEventRepository;
import com.merhouse.repository.ShipmentRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OperationalDetailService {
    private final CustomerOrderRepository orderRepository;
    private final FulfillmentAllocationRepository allocationRepository;
    private final ShipmentRepository shipmentRepository;
    private final InboundStockRequestRepository inboundRepository;
    private final InventoryItemRepository itemRepository;
    private final InventoryAuditLogRepository auditLogRepository;
    private final MerchantWarehouseRelationshipRepository relationshipRepository;
    private final OutboxEventRepository outboxRepository;
    private final CarrierDispatchRepository carrierDispatchRepository;
    private final CurrentUserService currentUserService;

    public OperationalDetailService(
        CustomerOrderRepository orderRepository,
        FulfillmentAllocationRepository allocationRepository,
        ShipmentRepository shipmentRepository,
        InboundStockRequestRepository inboundRepository,
        InventoryItemRepository itemRepository,
        InventoryAuditLogRepository auditLogRepository,
        MerchantWarehouseRelationshipRepository relationshipRepository,
        OutboxEventRepository outboxRepository,
        CarrierDispatchRepository carrierDispatchRepository,
        CurrentUserService currentUserService
    ) {
        this.orderRepository = orderRepository;
        this.allocationRepository = allocationRepository;
        this.shipmentRepository = shipmentRepository;
        this.inboundRepository = inboundRepository;
        this.itemRepository = itemRepository;
        this.auditLogRepository = auditLogRepository;
        this.relationshipRepository = relationshipRepository;
        this.outboxRepository = outboxRepository;
        this.carrierDispatchRepository = carrierDispatchRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public OrderDetailResponse orderDetail(UUID orderId) {
        CustomerOrder order = orderRepository.findWithDetailsById(orderId)
            .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        requireOrderRead(order);

        List<Shipment> shipments = order.getAllocations().stream()
            .map(FulfillmentAllocation::getShipment)
            .filter(shipment -> shipment != null)
            .toList();
        List<CarrierDispatch> carrierDispatches = shipments.stream()
            .flatMap(shipment -> carrierDispatchRepository.findByShipmentIdOrderByCreatedAtDesc(shipment.getId()).stream())
            .toList();
        List<OutboxEvent> outboxEvents = outboxEventsFor(orderAggregateIds(order));
        List<TimelineEventResponse> timeline = sortTimeline(timelineForOrder(order, outboxEvents, carrierDispatches));

        return new OrderDetailResponse(
            OrderResponse.from(order),
            shipments.stream().map(ShipmentResponse::from).toList(),
            carrierDispatches.stream().map(CarrierDispatchResponse::from).toList(),
            outboxEvents.stream().map(OutboxEventResponse::from).toList(),
            timeline
        );
    }

    @Transactional(readOnly = true)
    public InventoryItemDetailResponse inventoryItemDetail(UUID itemId) {
        InventoryItem item = itemRepository.findWithMerchantById(itemId)
            .orElseThrow(() -> new ResourceNotFoundException("Inventory item not found: " + itemId));
        requireMerchantSideRead(item.getMerchant().getId());

        List<InventoryAuditLog> auditLogs = auditLogRepository.findTop50ByInventoryItemIdOrderByOccurredAtDesc(item.getId());
        List<InboundStockRequest> inboundRequests = inboundRepository.findByMerchantIdOrderByCreatedAtDesc(item.getMerchant().getId()).stream()
            .filter(request -> request.getInventoryItem().getId().equals(item.getId()))
            .toList();
        List<TimelineEventResponse> timeline = new ArrayList<>();
        timeline.add(event(item.getId(), "InventoryItem", "InventoryItemCreated", "Item created", item.getSku(), item.getCreatedAt()));
        auditLogs.forEach(log -> timeline.add(event(
            log.getId(),
            "InventoryAuditLog",
            log.getAction().name(),
            "Inventory " + humanize(log.getAction().name()),
            log.getWarehouse().getName() + ": quantity " + log.getBeforeQuantity() + " -> " + log.getAfterQuantity()
                + ", reserved " + log.getBeforeReservedQuantity() + " -> " + log.getAfterReservedQuantity(),
            log.getOccurredAt()
        )));
        inboundRequests.forEach(request -> timeline.add(event(
            request.getId(),
            "InboundStockRequest",
            "InboundStock" + request.getStatus().name(),
            "Inbound " + humanize(request.getStatus().name()),
            request.getWarehouseProvider().getName() + " / " + request.getWarehouse().getName()
                + ": requested " + request.getRequestedQuantity() + ", received " + request.getReceivedQuantity(),
            requestTime(request)
        )));

        return new InventoryItemDetailResponse(
            InventoryItemResponse.from(item),
            auditLogs.stream().map(InventoryAuditLogResponse::from).toList(),
            inboundRequests.stream().map(InboundStockRequestResponse::from).toList(),
            sortTimeline(timeline)
        );
    }

    @Transactional(readOnly = true)
    public InboundStockRequestDetailResponse inboundDetail(UUID inboundId) {
        InboundStockRequest inbound = inboundRepository.findWithDetailsById(inboundId)
            .orElseThrow(() -> new ResourceNotFoundException("Inbound stock request not found: " + inboundId));
        requireRelationshipRead(inbound.getMerchant().getId(), inbound.getWarehouseProvider().getId());

        List<InventoryAuditLog> auditLogs = auditLogRepository.findTop50ByInventoryItemIdOrderByOccurredAtDesc(
            inbound.getInventoryItem().getId()
        ).stream()
            .filter(log -> log.getWarehouse().getId().equals(inbound.getWarehouse().getId()))
            .toList();
        List<OutboxEvent> outboxEvents = outboxEventsFor(List.of(inbound.getId(), inbound.getRelationship().getId()));
        List<TimelineEventResponse> timeline = new ArrayList<>();
        timeline.add(event(
            inbound.getId(),
            "InboundStockRequest",
            "InboundStockSubmitted",
            "Inbound submitted",
            inbound.getMerchant().getName() + " requested " + inbound.getRequestedQuantity() + " units from "
                + inbound.getWarehouseProvider().getName(),
            inbound.getCreatedAt()
        ));
        timeline.add(event(
            inbound.getId(),
            "InboundStockRequest",
            "InboundStock" + inbound.getStatus().name(),
            "Inbound " + humanize(inbound.getStatus().name()),
            inboundStatusDetail(inbound),
            requestTime(inbound)
        ));
        auditLogs.forEach(log -> timeline.add(event(
            log.getId(),
            "InventoryAuditLog",
            log.getAction().name(),
            "Inventory " + humanize(log.getAction().name()),
            log.getWarehouse().getName() + ": quantity " + log.getBeforeQuantity() + " -> " + log.getAfterQuantity(),
            log.getOccurredAt()
        )));
        timeline.addAll(timelineForOutbox(outboxEvents));

        return new InboundStockRequestDetailResponse(
            InboundStockRequestResponse.from(inbound),
            MerchantWarehouseRelationshipResponse.from(inbound.getRelationship()),
            auditLogs.stream().map(InventoryAuditLogResponse::from).toList(),
            outboxEvents.stream().map(OutboxEventResponse::from).toList(),
            sortTimeline(timeline)
        );
    }

    @Transactional(readOnly = true)
    public ShipmentDetailResponse shipmentDetail(UUID shipmentId) {
        Shipment shipment = shipmentRepository.findWithDetailsById(shipmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Shipment not found: " + shipmentId));
        FulfillmentAllocation allocation = shipment.getAllocation();
        requireRelationshipRead(allocation.getOrder().getMerchant().getId(), allocation.getWarehouse().getTenant().getId());

        List<CarrierDispatch> dispatches = carrierDispatchRepository.findByShipmentIdOrderByCreatedAtDesc(shipment.getId());
        List<OutboxEvent> outboxEvents = outboxEventsFor(List.of(shipment.getId(), allocation.getId(), allocation.getOrder().getId()));
        List<TimelineEventResponse> timeline = sortTimeline(timelineForShipment(shipment, dispatches, outboxEvents));

        return new ShipmentDetailResponse(
            ShipmentResponse.from(shipment),
            allocationResponse(allocation),
            OrderResponse.from(allocation.getOrder()),
            dispatches.stream().map(CarrierDispatchResponse::from).toList(),
            outboxEvents.stream().map(OutboxEventResponse::from).toList(),
            timeline
        );
    }

    @Transactional(readOnly = true)
    public FulfillmentAllocationDetailResponse allocationDetail(UUID allocationId) {
        FulfillmentAllocation allocation = allocationRepository.findWithDetailsById(allocationId)
            .orElseThrow(() -> new ResourceNotFoundException("Fulfillment allocation not found: " + allocationId));
        requireRelationshipRead(allocation.getOrder().getMerchant().getId(), allocation.getWarehouse().getTenant().getId());
        CustomerOrder order = orderRepository.findWithDetailsById(allocation.getOrder().getId())
            .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + allocation.getOrder().getId()));

        List<Shipment> shipments = allocation.getShipment() == null ? List.of() : List.of(allocation.getShipment());
        List<CarrierDispatch> dispatches = shipments.stream()
            .flatMap(shipment -> carrierDispatchRepository.findByShipmentIdOrderByCreatedAtDesc(shipment.getId()).stream())
            .toList();
        List<OutboxEvent> outboxEvents = outboxEventsFor(List.of(allocation.getId(), order.getId()));
        List<TimelineEventResponse> timeline = new ArrayList<>();
        timeline.add(event(
            allocation.getId(),
            "FulfillmentAllocation",
            "FulfillmentAllocationCreated",
            "Allocation created",
            allocation.getWarehouse().getName() + " was assigned " + allocation.getItems().size() + " item row(s)",
            allocation.getCreatedAt()
        ));
        timeline.add(event(
            allocation.getId(),
            "FulfillmentAllocation",
            "FulfillmentAllocation" + allocation.getStatus().name(),
            "Allocation " + humanize(allocation.getStatus().name()),
            allocation.getOrder().getCustomerAddress(),
            allocation.getCreatedAt()
        ));
        shipments.forEach(shipment -> timeline.addAll(timelineForShipment(shipment, dispatches, List.of())));
        timeline.addAll(timelineForOutbox(outboxEvents));

        return new FulfillmentAllocationDetailResponse(
            allocationResponse(allocation),
            OrderResponse.from(order),
            shipments.stream().map(ShipmentResponse::from).toList(),
            dispatches.stream().map(CarrierDispatchResponse::from).toList(),
            outboxEvents.stream().map(OutboxEventResponse::from).toList(),
            sortTimeline(timeline)
        );
    }

    @Transactional(readOnly = true)
    public MerchantWarehouseRelationshipDetailResponse relationshipDetail(UUID relationshipId) {
        MerchantWarehouseRelationship relationship = relationshipRepository.findWithDetailsById(relationshipId)
            .orElseThrow(() -> new ResourceNotFoundException("Merchant-warehouse relationship not found: " + relationshipId));
        requireRelationshipRead(relationship.getMerchant().getId(), relationship.getWarehouseProvider().getId());

        List<InboundStockRequest> inboundRequests = inboundRepository.findByMerchantIdOrderByCreatedAtDesc(
            relationship.getMerchant().getId()
        ).stream()
            .filter(request -> request.getRelationship().getId().equals(relationship.getId()))
            .toList();
        List<FulfillmentAllocation> allocations = allocationRepository.findAll().stream()
            .filter(allocation -> allocation.getOrder().getMerchant().getId().equals(relationship.getMerchant().getId()))
            .filter(allocation -> allocation.getWarehouse().getTenant().getId().equals(relationship.getWarehouseProvider().getId()))
            .toList();
        List<UUID> aggregateIds = new ArrayList<>();
        aggregateIds.add(relationship.getId());
        inboundRequests.forEach(request -> aggregateIds.add(request.getId()));
        allocations.forEach(allocation -> aggregateIds.add(allocation.getId()));
        List<OutboxEvent> outboxEvents = outboxEventsFor(aggregateIds);

        List<TimelineEventResponse> timeline = new ArrayList<>();
        timeline.add(event(
            relationship.getId(),
            "MerchantWarehouseRelationship",
            "MerchantWarehouseRelationshipRequested",
            "Relationship requested",
            relationship.getMerchant().getName() + " requested service from " + relationship.getWarehouseProvider().getName(),
            relationship.getCreatedAt()
        ));
        if (relationship.getApprovedAt() != null) {
            timeline.add(event(
                relationship.getId(),
                "MerchantWarehouseRelationship",
                "MerchantWarehouseRelationshipActivated",
                "Relationship activated",
                relationship.getWarehouseProvider().getName() + " accepted the service relationship",
                relationship.getApprovedAt()
            ));
        }
        inboundRequests.forEach(request -> timeline.add(event(
            request.getId(),
            "InboundStockRequest",
            "InboundStock" + request.getStatus().name(),
            "Inbound " + humanize(request.getStatus().name()),
            request.getWarehouse().getName() + ": requested " + request.getRequestedQuantity()
                + ", received " + request.getReceivedQuantity(),
            requestTime(request)
        )));
        allocations.forEach(allocation -> timeline.add(event(
            allocation.getId(),
            "FulfillmentAllocation",
            "FulfillmentAllocation" + allocation.getStatus().name(),
            "Allocation " + humanize(allocation.getStatus().name()),
            allocation.getWarehouse().getName() + " serving order " + allocation.getOrder().getId(),
            allocation.getCreatedAt()
        )));
        timeline.addAll(timelineForOutbox(outboxEvents));

        return new MerchantWarehouseRelationshipDetailResponse(
            MerchantWarehouseRelationshipResponse.from(relationship),
            inboundRequests.stream().map(InboundStockRequestResponse::from).toList(),
            allocations.stream().map(this::allocationResponse).toList(),
            outboxEvents.stream().map(OutboxEventResponse::from).toList(),
            sortTimeline(timeline)
        );
    }

    private FulfillmentAllocationResponse allocationResponse(FulfillmentAllocation allocation) {
        MerchantWarehouseRelationship relationship = relationshipRepository
            .findByMerchantIdAndWarehouseProviderId(
                allocation.getOrder().getMerchant().getId(),
                allocation.getWarehouse().getTenant().getId()
            )
            .orElse(null);
        return FulfillmentAllocationResponse.from(allocation, relationship);
    }

    private List<UUID> orderAggregateIds(CustomerOrder order) {
        Set<UUID> aggregateIds = new LinkedHashSet<>();
        aggregateIds.add(order.getId());
        order.getAllocations().forEach(allocation -> {
            aggregateIds.add(allocation.getId());
            if (allocation.getShipment() != null) {
                aggregateIds.add(allocation.getShipment().getId());
            }
        });
        order.getBackorders().forEach(backorder -> aggregateIds.add(backorder.getId()));
        return List.copyOf(aggregateIds);
    }

    private List<OutboxEvent> outboxEventsFor(List<UUID> aggregateIds) {
        if (aggregateIds.isEmpty()) {
            return List.of();
        }
        return outboxRepository.findByAggregateIdInOrderByCreatedAtDesc(aggregateIds);
    }

    private List<TimelineEventResponse> timelineForOrder(
        CustomerOrder order,
        List<OutboxEvent> outboxEvents,
        List<CarrierDispatch> carrierDispatches
    ) {
        List<TimelineEventResponse> timeline = new ArrayList<>();
        timeline.add(event(
            order.getId(),
            "CustomerOrder",
            "OrderCreated",
            "Order created",
            order.getMerchant().getName() + " order for " + order.getCustomerAddress(),
            order.getCreatedAt()
        ));
        timeline.add(event(
            order.getId(),
            "CustomerOrder",
            "Order" + order.getStatus().name(),
            "Order " + humanize(order.getStatus().name()),
            order.getItems().stream().map(item -> item.getInventoryItem().getSku() + " x" + item.getQuantity()).toList().toString(),
            order.getCreatedAt()
        ));
        order.getAllocations().forEach(allocation -> timeline.add(event(
            allocation.getId(),
            "FulfillmentAllocation",
            "FulfillmentAllocation" + allocation.getStatus().name(),
            "Warehouse allocation " + humanize(allocation.getStatus().name()),
            allocation.getWarehouse().getName() + " assigned "
                + allocation.getItems().stream().mapToInt(item -> item.getQuantity()).sum() + " unit(s)",
            allocation.getCreatedAt()
        )));
        for (BackorderItem backorder : order.getBackorders()) {
            timeline.add(event(
                backorder.getId(),
                "BackorderItem",
                "Backorder" + backorder.getStatus().name(),
                "Backorder " + humanize(backorder.getStatus().name()),
                backorder.getInventoryItem().getSku() + " x" + backorder.getQuantity(),
                backorder.getCreatedAt()
            ));
        }
        order.getAllocations().stream()
            .map(FulfillmentAllocation::getShipment)
            .filter(shipment -> shipment != null)
            .forEach(shipment -> timeline.addAll(timelineForShipment(shipment, carrierDispatches, List.of())));
        timeline.addAll(timelineForOutbox(outboxEvents));
        return timeline;
    }

    private List<TimelineEventResponse> timelineForShipment(
        Shipment shipment,
        List<CarrierDispatch> dispatches,
        List<OutboxEvent> outboxEvents
    ) {
        List<TimelineEventResponse> timeline = new ArrayList<>();
        timeline.add(event(
            shipment.getId(),
            "Shipment",
            "ShipmentCreated",
            "Shipment created",
            shipment.getCarrier() + " " + nullToBlank(shipment.getTrackingNumber()),
            shipment.getCreatedAt()
        ));
        timeline.add(event(
            shipment.getId(),
            "Shipment",
            "Shipment" + shipment.getStatus().name(),
            "Shipment " + humanize(shipment.getStatus().name()),
            shipment.getAllocation().getOrder().getCustomerAddress(),
            shipment.getCreatedAt()
        ));
        dispatches.stream()
            .filter(dispatch -> dispatch.getShipmentId().equals(shipment.getId()))
            .forEach(dispatch -> timeline.add(event(
                dispatch.getId(),
                "CarrierDispatch",
                dispatch.getEventType(),
                "Carrier dispatch " + humanize(dispatch.getStatus()),
                dispatch.getCarrier() + " " + nullToBlank(dispatch.getTrackingNumber()),
                dispatch.getCreatedAt()
            )));
        timeline.addAll(timelineForOutbox(outboxEvents));
        return timeline;
    }

    private List<TimelineEventResponse> timelineForOutbox(List<OutboxEvent> events) {
        return events.stream()
            .map(event -> event(
                event.getId(),
                "OutboxEvent",
                event.getEventType(),
                "Outbox " + humanize(event.getStatus()),
                event.getAggregateType() + " event " + humanize(event.getEventType()),
                event.getCreatedAt()
            ))
            .toList();
    }

    private TimelineEventResponse event(
        UUID sourceId,
        String sourceType,
        String eventType,
        String label,
        String detail,
        Instant occurredAt
    ) {
        return new TimelineEventResponse(sourceId, sourceType, eventType, label, detail, occurredAt);
    }

    private List<TimelineEventResponse> sortTimeline(List<TimelineEventResponse> timeline) {
        return timeline.stream()
            .sorted(Comparator.comparing(TimelineEventResponse::occurredAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
            .toList();
    }

    private String inboundStatusDetail(InboundStockRequest inbound) {
        return "requested " + inbound.getRequestedQuantity() + ", received " + inbound.getReceivedQuantity()
            + ", damaged " + inbound.getDamagedQuantity()
            + (inbound.getRejectionReason() == null ? "" : ", rejected: " + inbound.getRejectionReason());
    }

    private Instant requestTime(InboundStockRequest inbound) {
        if (inbound.getReceivedAt() != null) {
            return inbound.getReceivedAt();
        }
        if (inbound.getUpdatedAt() != null) {
            return inbound.getUpdatedAt();
        }
        return inbound.getCreatedAt();
    }

    private String humanize(String value) {
        StringBuilder text = new StringBuilder();
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            char previous = index == 0 ? 0 : value.charAt(index - 1);
            if (index > 0 && current != '_' && previous != '_' && Character.isUpperCase(current) && Character.isLowerCase(previous)) {
                text.append(' ');
            }
            text.append(current == '_' ? ' ' : Character.toLowerCase(current));
        }
        return text.toString();
    }

    private String nullToBlank(String value) {
        return value == null ? "" : value;
    }

    private void requireOrderRead(CustomerOrder order) {
        if (currentUserService.isAdmin()) {
            return;
        }
        if (currentUserService.hasRole(UserRole.MERCHANT)) {
            currentUserService.requireAdminOrTenant(order.getMerchant().getId());
            return;
        }
        UUID tenantId = currentUserService.required().tenantId();
        boolean servesOrder = order.getAllocations().stream()
            .anyMatch(allocation -> allocation.getWarehouse().getTenant().getId().equals(tenantId));
        if (!servesOrder) {
            throw new AccessDeniedException("You cannot access resources for another tenant.");
        }
    }

    private void requireMerchantSideRead(UUID merchantId) {
        if (currentUserService.isAdmin()) {
            return;
        }
        if (!currentUserService.hasRole(UserRole.MERCHANT)) {
            throw new AccessDeniedException("You cannot access merchant inventory detail.");
        }
        currentUserService.requireAdminOrTenant(merchantId);
    }

    private void requireRelationshipRead(UUID merchantId, UUID warehouseProviderId) {
        if (currentUserService.isAdmin()) {
            return;
        }
        UUID tenantId = currentUserService.required().tenantId();
        if (!tenantId.equals(merchantId) && !tenantId.equals(warehouseProviderId)) {
            throw new AccessDeniedException("You cannot access resources for another tenant.");
        }
    }
}
