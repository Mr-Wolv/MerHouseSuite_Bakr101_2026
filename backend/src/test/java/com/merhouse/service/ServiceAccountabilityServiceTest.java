package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.dto.CreateServiceAgreementRequest;
import com.merhouse.dto.CreateServiceStatementRequest;
import com.merhouse.dto.RateCardRequest;
import com.merhouse.dto.ServiceStatementLineRequest;
import com.merhouse.dto.SlaPolicyRequest;
import com.merhouse.entity.MerchantWarehouseRelationship;
import com.merhouse.entity.MerchantWarehouseRelationshipStatus;
import com.merhouse.entity.ReferenceRateCard;
import com.merhouse.entity.ServiceAgreement;
import com.merhouse.entity.ServiceAgreementStatus;
import com.merhouse.entity.ServiceScope;
import com.merhouse.entity.ServiceSourceType;
import com.merhouse.entity.ServiceStatement;
import com.merhouse.entity.ServiceStatementLineType;
import com.merhouse.entity.ServiceStatementStatus;
import com.merhouse.entity.SlaPolicy;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.MerchantWarehouseRelationshipRepository;
import com.merhouse.repository.FulfillmentAllocationRepository;
import com.merhouse.repository.InboundStockRequestRepository;
import com.merhouse.repository.ServiceClaimRepository;
import com.merhouse.repository.ServiceAgreementRepository;
import com.merhouse.repository.ServiceDisputeRepository;
import com.merhouse.repository.ServiceReviewRequestRepository;
import com.merhouse.repository.ServiceStatementRepository;
import com.merhouse.repository.ShipmentRepository;
import com.merhouse.security.UserPrincipal;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

class ServiceAccountabilityServiceTest {
    private final MerchantWarehouseRelationshipRepository relationshipRepository =
        org.mockito.Mockito.mock(MerchantWarehouseRelationshipRepository.class);
    private final ServiceAgreementRepository agreementRepository =
        org.mockito.Mockito.mock(ServiceAgreementRepository.class);
    private final ServiceStatementRepository statementRepository =
        org.mockito.Mockito.mock(ServiceStatementRepository.class);
    private final ServiceDisputeRepository disputeRepository =
        org.mockito.Mockito.mock(ServiceDisputeRepository.class);
    private final ServiceClaimRepository claimRepository =
        org.mockito.Mockito.mock(ServiceClaimRepository.class);
    private final ServiceReviewRequestRepository reviewRepository =
        org.mockito.Mockito.mock(ServiceReviewRequestRepository.class);
    private final InboundStockRequestRepository inboundRepository =
        org.mockito.Mockito.mock(InboundStockRequestRepository.class);
    private final FulfillmentAllocationRepository allocationRepository =
        org.mockito.Mockito.mock(FulfillmentAllocationRepository.class);
    private final ShipmentRepository shipmentRepository =
        org.mockito.Mockito.mock(ShipmentRepository.class);
    private final CurrentUserService currentUserService = org.mockito.Mockito.mock(CurrentUserService.class);
    private final ServiceAccountabilityService service = new ServiceAccountabilityService(
        relationshipRepository,
        agreementRepository,
        statementRepository,
        disputeRepository,
        claimRepository,
        reviewRepository,
        inboundRepository,
        allocationRepository,
        shipmentRepository,
        currentUserService
    );

    @Test
    void createAgreementBuildsDraftAgreementForActiveRelationship() {
        Tenant merchant = tenant(TenantType.MERCHANT, "Merchant");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER, "Provider");
        MerchantWarehouseRelationship relationship = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.ACTIVE);

        when(relationshipRepository.findWithDetailsById(relationship.getId())).thenReturn(Optional.of(relationship));
        when(agreementRepository.countByRelationshipId(relationship.getId())).thenReturn(1L);
        when(agreementRepository.saveAndFlush(any(ServiceAgreement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.createAgreement(new CreateServiceAgreementRequest(
            relationship.getId(),
            " Standard receiving ",
            LocalDate.now().plusDays(1),
            LocalDate.now().plusMonths(1),
            14,
            List.of(ServiceScope.INBOUND_RECEIVING, ServiceScope.STORAGE),
            "  Internal service-accountability record  ",
            null,
            new RateCardRequest(
                new BigDecimal("2.50"),
                new BigDecimal("0.10"),
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
                new BigDecimal("1.00"),
                "Carrier cost is only a pass-through note"
            ),
            new SlaPolicyRequest(48, 24, 12, 8, "Agreement hold pauses SLA")
        ));

        assertEquals(ServiceAgreementStatus.DRAFT, response.status());
        assertEquals(2, response.versionNumber());
        assertEquals("Standard receiving", response.title());
        assertEquals(new BigDecimal("2.50"), response.rateCard().inboundReceivingFeePerUnit());
        assertEquals(48, response.slaPolicy().receivingSlaHours());
        verify(currentUserService).requireAdminOrTenant(merchant.getId());
    }

    @Test
    void createAgreementRejectsInactiveRelationship() {
        Tenant merchant = tenant(TenantType.MERCHANT, "Merchant");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER, "Provider");
        MerchantWarehouseRelationship relationship = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.REQUESTED);

        when(relationshipRepository.findWithDetailsById(relationship.getId())).thenReturn(Optional.of(relationship));

        assertThrows(DomainConflictException.class, () -> service.createAgreement(defaultAgreementRequest(relationship)));
        verify(agreementRepository, never()).saveAndFlush(any());
    }

    @Test
    void proposedAgreementCanOnlyBeAcceptedByWarehouseProviderSide() {
        Tenant merchant = tenant(TenantType.MERCHANT, "Merchant");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER, "Provider");
        ServiceAgreement agreement = agreement(merchant, provider, ServiceAgreementStatus.PROPOSED);

        when(agreementRepository.findWithDetailsById(agreement.getId())).thenReturn(Optional.of(agreement));
        when(agreementRepository.saveAndFlush(agreement)).thenReturn(agreement);

        service.acceptAgreement(agreement.getId());

        assertEquals(ServiceAgreementStatus.ACTIVE, agreement.getStatus());
        verify(currentUserService).requireAdminOrTenant(provider.getId());
    }

    @Test
    void createStatementCalculatesCoordinationFeeAndReturnsExistingIdempotentStatement() {
        Tenant merchant = tenant(TenantType.MERCHANT, "Merchant");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER, "Provider");
        ServiceAgreement agreement = agreement(merchant, provider, ServiceAgreementStatus.ACTIVE);
        CreateServiceStatementRequest request = new CreateServiceStatementRequest(
            LocalDate.now(),
            LocalDate.now().plusDays(7),
            LocalDate.now().plusDays(14),
            "statement-key-1",
            "Inbound and storage work",
            List.of(new ServiceStatementLineRequest(
                ServiceStatementLineType.RECEIVING,
                ServiceSourceType.INBOUND_STOCK_REQUEST,
                UUID.randomUUID(),
                "Received units",
                4,
                new BigDecimal("10.00")
            ))
        );

        when(agreementRepository.findWithDetailsById(agreement.getId())).thenReturn(Optional.of(agreement));
        when(currentUserService.isAdmin()).thenReturn(false);
        when(currentUserService.required()).thenReturn(new UserPrincipal(
            UUID.randomUUID(),
            merchant.getId(),
            "merchant@example.test",
            UserRole.MERCHANT,
            true
        ));
        when(statementRepository.findByIdempotencyKey("statement-key-1")).thenReturn(Optional.empty());
        when(statementRepository.saveAndFlush(any(ServiceStatement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var created = service.createStatement(agreement.getId(), request);

        assertEquals(ServiceStatementStatus.DRAFT, created.status());
        assertEquals(new BigDecimal("40.00"), created.subtotalAmount());
        assertEquals(new BigDecimal("3.00"), created.coordinationFeeAmount());
        assertEquals(new BigDecimal("43.00"), created.totalAmount());

        ServiceStatement existing = statement(agreement, ServiceStatementStatus.DRAFT);
        existing.setIdempotencyKey("statement-key-1");
        when(statementRepository.findByIdempotencyKey("statement-key-1")).thenReturn(Optional.of(existing));

        var replay = service.createStatement(agreement.getId(), request);

        assertEquals(existing.getId(), replay.id());
    }

    @Test
    void wrongTenantCannotReadAgreement() {
        Tenant merchant = tenant(TenantType.MERCHANT, "Merchant");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER, "Provider");
        ServiceAgreement agreement = agreement(merchant, provider, ServiceAgreementStatus.ACTIVE);

        when(agreementRepository.findWithDetailsById(agreement.getId())).thenReturn(Optional.of(agreement));
        when(currentUserService.isAdmin()).thenReturn(false);
        when(currentUserService.required()).thenReturn(new UserPrincipal(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "other@example.test",
            UserRole.MERCHANT,
            true
        ));

        assertThrows(AccessDeniedException.class, () -> service.getAgreement(agreement.getId()));
    }

    @Test
    void finalizedStatementCannotBeEditedBackThroughFinalize() {
        Tenant merchant = tenant(TenantType.MERCHANT, "Merchant");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER, "Provider");
        ServiceAgreement agreement = agreement(merchant, provider, ServiceAgreementStatus.ACTIVE);
        ServiceStatement statement = statement(agreement, ServiceStatementStatus.MARKED_SETTLED);

        when(statementRepository.findWithDetailsById(statement.getId())).thenReturn(Optional.of(statement));
        when(currentUserService.isAdmin()).thenReturn(true);

        assertThrows(DomainConflictException.class, () -> service.finalizeStatement(statement.getId()));
        verify(statementRepository, never()).saveAndFlush(any());
    }

    private CreateServiceAgreementRequest defaultAgreementRequest(MerchantWarehouseRelationship relationship) {
        return new CreateServiceAgreementRequest(
            relationship.getId(),
            "Standard",
            LocalDate.now().plusDays(1),
            null,
            0,
            List.of(ServiceScope.INBOUND_RECEIVING),
            null,
            null,
            null,
            null
        );
    }

    private Tenant tenant(TenantType type, String name) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        tenant.setType(type);
        tenant.setName(name);
        return tenant;
    }

    private MerchantWarehouseRelationship relationship(
        Tenant merchant,
        Tenant provider,
        MerchantWarehouseRelationshipStatus status
    ) {
        MerchantWarehouseRelationship relationship = new MerchantWarehouseRelationship();
        ReflectionTestUtils.setField(relationship, "id", UUID.randomUUID());
        relationship.setMerchant(merchant);
        relationship.setWarehouseProvider(provider);
        relationship.setStatus(status);
        return relationship;
    }

    private ServiceAgreement agreement(Tenant merchant, Tenant provider, ServiceAgreementStatus status) {
        ServiceAgreement agreement = new ServiceAgreement();
        ReflectionTestUtils.setField(agreement, "id", UUID.randomUUID());
        MerchantWarehouseRelationship relationship = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.ACTIVE);
        agreement.setRelationship(relationship);
        agreement.setMerchant(merchant);
        agreement.setWarehouseProvider(provider);
        agreement.setStatus(status);
        agreement.setTitle("Standard");
        agreement.setVersionNumber(1);
        agreement.setEffectiveDate(LocalDate.now());
        agreement.setCancellationWindowDays(0);
        agreement.setServiceScopes(ServiceScope.INBOUND_RECEIVING.name());
        ReferenceRateCard card = new ReferenceRateCard();
        card.setCoordinationFeePercent(new BigDecimal("5.00"));
        card.setFixedCoordinationFee(BigDecimal.ONE);
        agreement.setRateCard(card);
        SlaPolicy policy = new SlaPolicy();
        policy.setReceivingSlaHours(48);
        policy.setPickPackSlaHours(24);
        policy.setShipmentHandoffSlaHours(12);
        policy.setExceptionResponseSlaHours(8);
        agreement.setSlaPolicy(policy);
        return agreement;
    }

    private ServiceStatement statement(ServiceAgreement agreement, ServiceStatementStatus status) {
        ServiceStatement statement = new ServiceStatement();
        ReflectionTestUtils.setField(statement, "id", UUID.randomUUID());
        statement.setAgreement(agreement);
        statement.setMerchant(agreement.getMerchant());
        statement.setWarehouseProvider(agreement.getWarehouseProvider());
        statement.setStatus(status);
        statement.setPeriodStart(LocalDate.now());
        statement.setPeriodEnd(LocalDate.now().plusDays(7));
        statement.setDueDate(LocalDate.now().plusDays(14));
        statement.setSubtotalAmount(BigDecimal.TEN);
        statement.setCoordinationFeeAmount(BigDecimal.ONE);
        statement.setAdjustmentAmount(BigDecimal.ZERO);
        statement.setTotalAmount(new BigDecimal("11.00"));
        return statement;
    }
}
