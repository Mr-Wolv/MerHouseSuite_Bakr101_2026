package com.merhouse.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.merhouse.config.JacksonConfig;
import com.merhouse.dto.AdjustStockRequest;
import com.merhouse.dto.AdvanceBackorderRequest;
import com.merhouse.dto.AdvanceShipmentRequest;
import com.merhouse.dto.CreateInboundStockRequest;
import com.merhouse.dto.CreateServiceAgreementRequest;
import com.merhouse.dto.CreateServiceStatementRequest;
import com.merhouse.dto.MerchantAuthorizedStockResponse;
import com.merhouse.dto.OrderResponse;
import com.merhouse.dto.RateCardRequest;
import com.merhouse.dto.RemoveStockRequest;
import com.merhouse.dto.ServiceAgreementResponse;
import com.merhouse.dto.ServiceStatementLineRequest;
import com.merhouse.dto.ShipmentResponse;
import com.merhouse.dto.SlaPolicyRequest;
import com.merhouse.entity.BackorderStatus;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.OrderStatus;
import com.merhouse.entity.ServiceAgreementStatus;
import com.merhouse.entity.ServiceScope;
import com.merhouse.entity.ServiceSourceType;
import com.merhouse.entity.ServiceStatementLineType;
import com.merhouse.entity.ShipmentStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.Warehouse;
import com.merhouse.entity.WarehouseInventory;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.security.JwtService;
import com.merhouse.service.AppUserDetailsService;
import com.merhouse.service.AdminAuditService;
import com.merhouse.service.CurrentUserService;
import com.merhouse.service.FulfillmentService;
import com.merhouse.service.IdempotencyService;
import com.merhouse.service.InventoryService;
import com.merhouse.service.MerchantWarehouseService;
import com.merhouse.service.OrderService;
import com.merhouse.service.OrderImportService;
import com.merhouse.service.ServiceAccountabilityService;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({
    HealthController.class,
    InventoryController.class,
    FulfillmentController.class,
    MerchantWarehouseController.class,
    ServiceAccountabilityController.class,
    OrderController.class,
    ApiExceptionHandler.class
})
@AutoConfigureMockMvc(addFilters = false)
@Import(JacksonConfig.class)
class ApiControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private InventoryService inventoryService;

    @MockitoBean
    private FulfillmentService fulfillmentService;

    @MockitoBean
    private MerchantWarehouseService merchantWarehouseService;

    @MockitoBean
    private ServiceAccountabilityService serviceAccountabilityService;

    @MockitoBean
    private OrderService orderService;

    @MockitoBean
    private OrderImportService orderImportService;

    @MockitoBean
    private IdempotencyService idempotencyService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private AppUserDetailsService appUserDetailsService;

    @MockitoBean
    private AppUserRepository appUserRepository;

    @MockitoBean
    private CurrentUserService currentUserService;

    @MockitoBean
    private AdminAuditService adminAuditService;

    @MockitoBean
    private DataSource dataSource;

    @Test
    void healthEndpointReportsReadinessWithoutDomainData() throws Exception {
        java.sql.Connection connection = mock(java.sql.Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(anyInt())).thenReturn(true);
        mockMvc.perform(get("/api/v1/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void healthEndpointReportsDownWhenDatabaseIsUnreachable() throws Exception {
        when(dataSource.getConnection()).thenThrow(new java.sql.SQLException("Connection refused"));
        mockMvc.perform(get("/api/v1/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DOWN"));
    }

    @Test
    void removeStockEndpointValidatesAndDelegatesToInventoryService() throws Exception {
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        when(inventoryService.removeStock(any(RemoveStockRequest.class)))
            .thenReturn(warehouseInventory(warehouseId, itemId, 8, 3));

        mockMvc.perform(post("/api/v1/inventory/stock/remove")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new RemoveStockRequest(warehouseId, itemId, 4))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.warehouseId").value(warehouseId.toString()))
            .andExpect(jsonPath("$.inventoryItemId").value(itemId.toString()))
            .andExpect(jsonPath("$.quantity").value(8))
            .andExpect(jsonPath("$.reservedQuantity").value(3))
            .andExpect(jsonPath("$.availableQuantity").value(5));

        verify(inventoryService).removeStock(eq(new RemoveStockRequest(warehouseId, itemId, 4)));
    }

    @Test
    void removeStockEndpointRejectsInvalidQuantityBeforeServiceCall() throws Exception {
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/inventory/stock/remove")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new RemoveStockRequest(warehouseId, itemId, 0))))
            .andExpect(status().isBadRequest());

        verify(inventoryService, never()).removeStock(any());
    }

    @Test
    void adjustStockEndpointRejectsMissingReasonBeforeServiceCall() throws Exception {
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/inventory/stock/adjust")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new AdjustStockRequest(
                    warehouseId,
                    itemId,
                    -2,
                    "",
                    "Cycle count shortage"
                ))))
            .andExpect(status().isBadRequest());

        verify(inventoryService, never()).adjustStock(any());
    }

    @Test
    void advanceShipmentEndpointDelegatesTerminalStatus() throws Exception {
        UUID shipmentId = UUID.randomUUID();
        UUID allocationId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID warehouseId = UUID.randomUUID();
        when(fulfillmentService.advanceShipment(shipmentId, ShipmentStatus.FAILED))
            .thenReturn(new ShipmentResponse(
                shipmentId,
                allocationId,
                orderId,
                warehouseId,
                "Smoke Carrier",
                "TRACK-1",
                2,
                new BigDecimal("4.50"),
                40,
                30,
                20,
                "Packed in two cartons",
                ShipmentStatus.FAILED,
                List.of(),
                Map.of("source", "api-test"),
                Instant.parse("2026-05-17T00:00:00Z")
            ));

        mockMvc.perform(patch("/api/v1/shipments/{id}/status", shipmentId)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new AdvanceShipmentRequest(ShipmentStatus.FAILED))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(shipmentId.toString()))
            .andExpect(jsonPath("$.status").value("FAILED"));

        verify(fulfillmentService).advanceShipment(shipmentId, ShipmentStatus.FAILED);
    }

    @Test
    void updateBackorderEndpointDelegatesBackorderStatus() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID backorderId = UUID.randomUUID();
        UUID merchantId = UUID.randomUUID();
        when(orderService.updateBackorder(orderId, backorderId, BackorderStatus.FULFILLED))
            .thenReturn(new OrderResponse(
                orderId,
                merchantId,
                "Customer",
                OrderStatus.ALLOCATED,
                List.of(),
                List.of(),
                List.of(),
                Instant.parse("2026-05-17T00:00:00Z")
            ));

        mockMvc.perform(patch("/api/v1/orders/{orderId}/backorders/{backorderId}/status", orderId, backorderId)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new AdvanceBackorderRequest(BackorderStatus.FULFILLED))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(orderId.toString()))
            .andExpect(jsonPath("$.status").value("ALLOCATED"));

        verify(orderService).updateBackorder(orderId, backorderId, BackorderStatus.FULFILLED);
    }

    @Test
    void authorizedStockEndpointDelegatesMerchantScopedReadModel() throws Exception {
        UUID merchantId = UUID.randomUUID();
        UUID relationshipId = UUID.randomUUID();
        UUID providerId = UUID.randomUUID();
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        when(merchantWarehouseService.findAuthorizedStock(merchantId))
            .thenReturn(List.of(new MerchantAuthorizedStockResponse(
                relationshipId,
                merchantId,
                "Adidas",
                providerId,
                "FedEx",
                warehouseId,
                "Cairo Hub",
                itemId,
                "SKU-1",
                "Running Shoe",
                10,
                2,
                8,
                5
            )));

        mockMvc.perform(get("/api/v1/merchant-warehouse/authorized-stock")
                .param("merchantId", merchantId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].relationshipId").value(relationshipId.toString()))
            .andExpect(jsonPath("$[0].warehouseProviderName").value("FedEx"))
            .andExpect(jsonPath("$[0].warehouseName").value("Cairo Hub"))
            .andExpect(jsonPath("$[0].availableQuantity").value(8))
            .andExpect(jsonPath("$[0].inboundQuantity").value(5));

        verify(merchantWarehouseService).findAuthorizedStock(merchantId);
    }

    @Test
    void submitInboundStockEndpointRejectsInvalidQuantityBeforeServiceCall() throws Exception {
        UUID relationshipId = UUID.randomUUID();
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/merchant-warehouse/inbound-stock-requests")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new CreateInboundStockRequest(
                    relationshipId,
                    warehouseId,
                    itemId,
                    0,
                    "ASN-1",
                    "Invalid quantity"
                ))))
            .andExpect(status().isBadRequest());

        verify(merchantWarehouseService, never()).submitInboundStock(any());
    }

    @Test
    void createServiceAgreementEndpointValidatesAndDelegatesServiceAccountabilityContract() throws Exception {
        UUID relationshipId = UUID.randomUUID();
        UUID agreementId = UUID.randomUUID();
        UUID merchantId = UUID.randomUUID();
        UUID providerId = UUID.randomUUID();
        CreateServiceAgreementRequest request = new CreateServiceAgreementRequest(
            relationshipId,
            "Standard receiving",
            LocalDate.now().plusDays(1),
            LocalDate.now().plusMonths(1),
            14,
            List.of(ServiceScope.INBOUND_RECEIVING, ServiceScope.STORAGE),
            "Internal coordination record",
            null,
            new RateCardRequest(
                new BigDecimal("2.50"),
                BigDecimal.ZERO,
                5,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("3.00"),
                BigDecimal.ONE,
                "Carrier note only"
            ),
            new SlaPolicyRequest(48, 24, 12, 8, "Agreement hold pauses SLA")
        );
        when(serviceAccountabilityService.createAgreement(any(CreateServiceAgreementRequest.class)))
            .thenReturn(new ServiceAgreementResponse(
                agreementId,
                relationshipId,
                merchantId,
                "Merchant",
                providerId,
                "Provider",
                ServiceAgreementStatus.DRAFT,
                "Standard receiving",
                1,
                request.effectiveDate(),
                request.renewalReviewDate(),
                14,
                request.serviceScopes(),
                request.serviceNotes(),
                null,
                null,
                null,
                Instant.parse("2026-05-20T00:00:00Z"),
                null,
                null,
                null,
                null,
                null
            ));

        mockMvc.perform(post("/api/v1/service-accountability/agreements")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(agreementId.toString()))
            .andExpect(jsonPath("$.relationshipId").value(relationshipId.toString()))
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.serviceScopes[0]").value("INBOUND_RECEIVING"));

        verify(serviceAccountabilityService).createAgreement(any(CreateServiceAgreementRequest.class));
    }

    @Test
    void createServiceStatementEndpointRejectsEmptyLinesBeforeServiceCall() throws Exception {
        UUID agreementId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/service-accountability/agreements/{agreementId}/statements", agreementId)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new CreateServiceStatementRequest(
                    LocalDate.now(),
                    LocalDate.now().plusDays(7),
                    LocalDate.now().plusDays(14),
                    "statement-key",
                    "No lines",
                    List.of()
                ))))
            .andExpect(status().isBadRequest());

        verify(serviceAccountabilityService, never()).createStatement(eq(agreementId), any());
    }

    @Test
    void createServiceStatementEndpointRejectsInvalidLineQuantityBeforeServiceCall() throws Exception {
        UUID agreementId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/service-accountability/agreements/{agreementId}/statements", agreementId)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new CreateServiceStatementRequest(
                    LocalDate.now(),
                    LocalDate.now().plusDays(7),
                    LocalDate.now().plusDays(14),
                    "statement-key",
                    "Bad line",
                    List.of(new ServiceStatementLineRequest(
                        ServiceStatementLineType.RECEIVING,
                        ServiceSourceType.INBOUND_STOCK_REQUEST,
                        UUID.randomUUID(),
                        "Received units",
                        0,
                        BigDecimal.TEN
                    ))
                ))))
            .andExpect(status().isBadRequest());

        verify(serviceAccountabilityService, never()).createStatement(eq(agreementId), any());
    }

    private WarehouseInventory warehouseInventory(UUID warehouseId, UUID itemId, int quantity, int reservedQuantity) {
        Tenant warehouseTenant = new Tenant();
        ReflectionTestUtils.setField(warehouseTenant, "id", UUID.randomUUID());
        warehouseTenant.setName("Warehouse Tenant");
        warehouseTenant.setType(TenantType.WAREHOUSE_PROVIDER);

        Warehouse warehouse = new Warehouse();
        ReflectionTestUtils.setField(warehouse, "id", warehouseId);
        warehouse.setTenant(warehouseTenant);
        warehouse.setName("Warehouse");
        warehouse.setAddress("Cairo");
        warehouse.setCapacity(100);

        Tenant merchant = new Tenant();
        ReflectionTestUtils.setField(merchant, "id", UUID.randomUUID());
        merchant.setName("Merchant");
        merchant.setType(TenantType.MERCHANT);

        InventoryItem item = new InventoryItem();
        ReflectionTestUtils.setField(item, "id", itemId);
        item.setMerchant(merchant);
        item.setSku("SKU-1");
        item.setName("Merchant Item");

        WarehouseInventory inventory = new WarehouseInventory(warehouse, item);
        inventory.setQuantity(quantity);
        inventory.setReservedQuantity(reservedQuantity);
        ReflectionTestUtils.setField(inventory, "version", 1L);
        ReflectionTestUtils.setField(inventory, "updatedAt", Instant.parse("2026-05-17T00:00:00Z"));
        return inventory;
    }
}
