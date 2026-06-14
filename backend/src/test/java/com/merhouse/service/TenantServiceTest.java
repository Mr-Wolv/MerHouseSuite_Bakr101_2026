package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.dto.CreateTenantRequest;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.TenantRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class TenantServiceTest {
    private final TenantRepository tenantRepository = mock(TenantRepository.class);
    private TenantService tenantService;

    @BeforeEach
    void setUp() {
        tenantService = new TenantService(tenantRepository);
    }

    @Test
    void createSavesTenantWithTrimmedName() {
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        Tenant result = tenantService.create(new CreateTenantRequest("  Acme Corp  ", TenantType.MERCHANT));

        assertEquals("Acme Corp", result.getName());
        assertEquals(TenantType.MERCHANT, result.getType());
        verify(tenantRepository).save(any(Tenant.class));
    }

    @Test
    void findAllDelegatesToRepository() {
        Tenant t1 = tenant("T1");
        Tenant t2 = tenant("T2");
        when(tenantRepository.findAll()).thenReturn(List.of(t1, t2));

        List<Tenant> result = tenantService.findAll();

        assertEquals(2, result.size());
        assertEquals("T1", result.get(0).getName());
    }

    @Test
    void findAllReturnsEmptyWhenNoTenants() {
        when(tenantRepository.findAll()).thenReturn(List.of());
        assertTrue(tenantService.findAll().isEmpty());
    }

    @Test
    void getRequiredReturnsExistingTenant() {
        UUID id = UUID.randomUUID();
        Tenant tenant = tenant("Found");
        ReflectionTestUtils.setField(tenant, "id", id);
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));

        Tenant result = tenantService.getRequired(id);

        assertEquals(id, result.getId());
    }

    @Test
    void getRequiredThrowsWhenNotFound() {
        UUID id = UUID.randomUUID();
        when(tenantRepository.findById(id)).thenReturn(Optional.empty());

        ResourceNotFoundException thrown = assertThrows(ResourceNotFoundException.class,
            () -> tenantService.getRequired(id));

        assertTrue(thrown.getMessage().contains(id.toString()));
    }

    @Test
    void suspendDeactivatesTenantWithReason() {
        UUID id = UUID.randomUUID();
        Tenant tenant = tenant("SuspendMe");
        ReflectionTestUtils.setField(tenant, "id", id);
        tenant.setActive(true);
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        Tenant result = tenantService.suspend(id, "Policy violation");

        assertFalse(result.isActive());
        assertEquals("Policy violation", result.getSuspensionReason());
        assertNotNull(result.getSuspendedAt());
    }

    @Test
    void suspendWithBlankReasonStoresNull() {
        UUID id = UUID.randomUUID();
        Tenant tenant = tenant("SuspendBlank");
        ReflectionTestUtils.setField(tenant, "id", id);
        tenant.setActive(true);
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        Tenant result = tenantService.suspend(id, "   ");

        assertFalse(result.isActive());
        assertNull(result.getSuspensionReason());
    }

    @Test
    void suspendWithNullReasonStoresNull() {
        UUID id = UUID.randomUUID();
        Tenant tenant = tenant("SuspendNull");
        ReflectionTestUtils.setField(tenant, "id", id);
        tenant.setActive(true);
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        Tenant result = tenantService.suspend(id, null);

        assertNull(result.getSuspensionReason());
    }

    @Test
    void suspendTrimsReason() {
        UUID id = UUID.randomUUID();
        Tenant tenant = tenant("SuspendTrim");
        ReflectionTestUtils.setField(tenant, "id", id);
        tenant.setActive(true);
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        Tenant result = tenantService.suspend(id, "  trimmed reason  ");

        assertEquals("trimmed reason", result.getSuspensionReason());
    }

    @Test
    void suspendThrowsWhenTenantNotFound() {
        UUID id = UUID.randomUUID();
        when(tenantRepository.findById(id)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> tenantService.suspend(id, "reason"));
    }

    @Test
    void activateReactivatesTenantAndClearsSuspension() {
        UUID id = UUID.randomUUID();
        Tenant tenant = tenant("Activate");
        ReflectionTestUtils.setField(tenant, "id", id);
        tenant.setActive(false);
        tenant.setSuspensionReason("old reason");
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        Tenant result = tenantService.activate(id);

        assertTrue(result.isActive());
        assertNull(result.getSuspensionReason());
        assertNull(result.getSuspendedAt());
    }

    @Test
    void activateThrowsWhenTenantNotFound() {
        UUID id = UUID.randomUUID();
        when(tenantRepository.findById(id)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> tenantService.activate(id));
    }

    @Test
    void suspendActivateRoundTrip() {
        UUID id = UUID.randomUUID();
        Tenant tenant = tenant("RoundTrip");
        ReflectionTestUtils.setField(tenant, "id", id);
        tenant.setActive(true);
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        // Suspend
        Tenant suspended = tenantService.suspend(id, "temporary");
        assertFalse(suspended.isActive());
        assertEquals("temporary", suspended.getSuspensionReason());

        // Activate
        Tenant activated = tenantService.activate(id);
        assertTrue(activated.isActive());
        assertNull(activated.getSuspensionReason());
        assertNull(activated.getSuspendedAt());
    }

    private Tenant tenant(String name) {
        Tenant t = new Tenant();
        ReflectionTestUtils.setField(t, "id", UUID.randomUUID());
        t.setName(name);
        t.setActive(true);
        return t;
    }
}
