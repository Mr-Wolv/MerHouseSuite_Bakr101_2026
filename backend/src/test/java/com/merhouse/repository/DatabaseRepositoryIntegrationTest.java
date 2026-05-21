package com.merhouse.repository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import com.merhouse.entity.BackorderItem;
import com.merhouse.entity.BackorderStatus;
import com.merhouse.entity.CustomerOrder;
import com.merhouse.entity.FulfillmentAllocation;
import com.merhouse.entity.FulfillmentAllocationItem;
import com.merhouse.entity.FulfillmentStatus;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.OrderItem;
import com.merhouse.entity.OutboxEvent;
import com.merhouse.entity.Shipment;
import com.merhouse.entity.ShipmentStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.Warehouse;
import com.merhouse.entity.WarehouseInventory;

import jakarta.persistence.EntityManager;

@SpringBootTest(properties = "merhouse.auth.seed-admin.enabled=false")
@Testcontainers
@Transactional
class DatabaseRepositoryIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17");

    @DynamicPropertySource
    static void configureDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private CustomerOrderRepository orderRepository;

    @Autowired
    private FulfillmentAllocationRepository allocationRepository;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Test
    void flywayMigrationsCreateCoreTablesAndShipmentStateConstraint() {
        List<String> expectedTables = List.of(
            "tenants",
            "warehouses",
            "inventory_items",
            "warehouse_inventory",
            "inventory_audit_logs",
            "customer_orders",
            "order_items",
            "fulfillment_allocations",
            "fulfillment_allocation_items",
            "shipments",
            "idempotency_records",
            "backorder_items",
            "outbox_events",
            "app_users",
            "carrier_dispatches"
        );

        List<String> actualTables = jdbcTemplate.queryForList(
            """
            select table_name
            from information_schema.tables
            where table_schema = 'public'
              and table_type = 'BASE TABLE'
            """,
            String.class
        );
        assertThat(actualTables).containsAll(expectedTables);

        String shipmentStatusConstraint = jdbcTemplate.queryForObject(
            """
            select pg_get_constraintdef(oid)
            from pg_constraint
            where conname = 'shipments_status_check'
            """,
            String.class
        );
        assertThat(shipmentStatusConstraint)
            .contains("IN_TRANSIT")
            .contains("DELIVERED")
            .contains("FAILED")
            .contains("RETURNED");
    }

    @Test
    void repositoriesLoadOrderAllocationBackorderAndShipmentGraphsFromRealPostgres() {
        Tenant merchant = tenant("Repository Merchant", TenantType.MERCHANT);
        Tenant warehouseProvider = tenant("Repository Warehouse Provider", TenantType.WAREHOUSE_PROVIDER);
        entityManager.persist(merchant);
        entityManager.persist(warehouseProvider);

        Warehouse warehouse = new Warehouse();
        warehouse.setTenant(warehouseProvider);
        warehouse.setName("Repository Warehouse");
        warehouse.setAddress("Cairo");
        warehouse.setCapacity(500);
        entityManager.persist(warehouse);

        InventoryItem item = new InventoryItem();
        item.setMerchant(merchant);
        item.setSku("REPO-SKU");
        item.setName("Repository Item");
        item.setAttributes(Map.of("source", "repository-test"));
        entityManager.persist(item);

        WarehouseInventory stock = new WarehouseInventory(warehouse, item);
        stock.setQuantity(12);
        stock.setReservedQuantity(5);
        entityManager.persist(stock);

        CustomerOrder order = new CustomerOrder();
        order.setMerchant(merchant);
        order.setCustomerAddress("Repository Customer, Cairo");

        OrderItem orderItem = new OrderItem();
        orderItem.setInventoryItem(item);
        orderItem.setQuantity(9);
        order.addItem(orderItem);

        FulfillmentAllocation allocation = new FulfillmentAllocation();
        allocation.setWarehouse(warehouse);
        allocation.setStatus(FulfillmentStatus.SHIPPED);
        FulfillmentAllocationItem allocationItem = new FulfillmentAllocationItem();
        allocationItem.setInventoryItem(item);
        allocationItem.setQuantity(5);
        allocation.addItem(allocationItem);
        order.addAllocation(allocation);

        BackorderItem backorder = new BackorderItem();
        backorder.setInventoryItem(item);
        backorder.setQuantity(4);
        backorder.setStatus(BackorderStatus.OPEN);
        order.addBackorder(backorder);
        entityManager.persist(order);

        Shipment shipment = new Shipment();
        shipment.setAllocation(allocation);
        shipment.setCarrier("Repository Carrier");
        shipment.setTrackingNumber("REPO-TRACK");
        shipment.setStatus(ShipmentStatus.RETURNED);
        shipment.setMetadata(Map.of("source", "repository-test"));
        entityManager.persist(shipment);

        entityManager.flush();
        UUID orderId = order.getId();
        UUID allocationId = allocation.getId();
        entityManager.clear();

        CustomerOrder loadedOrder = orderRepository.findWithDetailsById(orderId).orElseThrow();
        assertThat(loadedOrder.getItems()).hasSize(1);
        assertThat(loadedOrder.getAllocations()).hasSize(1);
        assertThat(loadedOrder.getBackorders()).hasSize(1);
        assertThat(loadedOrder.getBackorders().iterator().next().getStatus()).isEqualTo(BackorderStatus.OPEN);

        FulfillmentAllocation loadedAllocation = allocationRepository.findWithDetailsById(allocationId).orElseThrow();
        assertThat(loadedAllocation.getOrder().getCustomerAddress()).isEqualTo("Repository Customer, Cairo");
        assertThat(loadedAllocation.getWarehouse().getName()).isEqualTo("Repository Warehouse");
        assertThat(loadedAllocation.getItems()).hasSize(1);
        assertThat(loadedAllocation.getShipment()).isNotNull();
        assertThat(loadedAllocation.getShipment().getStatus()).isEqualTo(ShipmentStatus.RETURNED);
    }

    @Test
    void outboxRepositoryFindsPendingAndRetryableEventsButExcludesFutureAndExhaustedFailures() {
        Instant now = Instant.now();
        OutboxEvent pending = outboxEvent("OrderCreated", "PENDING", 0, now.minusSeconds(5));
        OutboxEvent retryable = outboxEvent("ShipmentFailed", "FAILED", 2, now.minusSeconds(5));
        OutboxEvent exhausted = outboxEvent("ShipmentReturned", "FAILED", 3, now.minusSeconds(5));
        OutboxEvent future = outboxEvent("OrderCancelled", "PENDING", 0, now.plusSeconds(60));

        entityManager.persist(pending);
        entityManager.persist(retryable);
        entityManager.persist(exhausted);
        entityManager.persist(future);
        entityManager.flush();
        entityManager.clear();

        List<OutboxEvent> processable = outboxEventRepository.findProcessable(now, 3, PageRequest.of(0, 10));

        assertThat(processable)
            .extracting(OutboxEvent::getEventType)
            .containsExactly("OrderCreated", "ShipmentFailed");
    }

    @Test
    void operationalIndexesSupportReadPaths() {
        List<String> actualIndexes = jdbcTemplate.queryForList(
            """
            select indexname
            from pg_indexes
            where schemaname = 'public'
            """,
            String.class
        );

        assertThat(actualIndexes).contains(
            "idx_customer_orders_merchant_created",
            "idx_order_items_order",
            "idx_order_items_inventory_item",
            "idx_fulfillment_allocations_order",
            "idx_fulfillment_allocations_warehouse_created",
            "idx_fulfillment_allocations_status",
            "idx_shipments_status_created",
            "idx_outbox_events_aggregate_created"
        );
    }

    private Tenant tenant(String name, TenantType type) {
        Tenant tenant = new Tenant();
        tenant.setName(name);
        tenant.setType(type);
        return tenant;
    }

    private OutboxEvent outboxEvent(String eventType, String status, int attempts, Instant nextAttemptAt) {
        OutboxEvent event = new OutboxEvent();
        event.setEventType(eventType);
        event.setAggregateType("TestAggregate");
        event.setAggregateId(UUID.randomUUID());
        event.setPayload(Map.of("eventType", eventType));
        event.setStatus(status);
        event.setAttempts(attempts);
        event.setNextAttemptAt(nextAttemptAt);
        return event;
    }
}
