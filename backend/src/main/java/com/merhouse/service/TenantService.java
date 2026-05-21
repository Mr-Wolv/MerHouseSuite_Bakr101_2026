package com.merhouse.service;

import com.merhouse.dto.CreateTenantRequest;
import com.merhouse.entity.Tenant;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.TenantRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenantService {
    private final TenantRepository tenantRepository;

    public TenantService(TenantRepository tenantRepository) {
        this.tenantRepository = tenantRepository;
    }

    @Transactional
    public Tenant create(CreateTenantRequest request) {
        Tenant tenant = new Tenant();
        tenant.setName(request.name().trim());
        tenant.setType(request.type());
        return tenantRepository.save(tenant);
    }

    @Transactional(readOnly = true)
    public List<Tenant> findAll() {
        return tenantRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Tenant getRequired(UUID id) {
        return tenantRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Tenant not found: " + id));
    }

    @Transactional
    public Tenant suspend(UUID id, String reason) {
        Tenant tenant = getRequired(id);
        tenant.setActive(false);
        tenant.setSuspensionReason(trimToNull(reason));
        tenant.setSuspendedAt(Instant.now());
        return tenantRepository.save(tenant);
    }

    @Transactional
    public Tenant activate(UUID id) {
        Tenant tenant = getRequired(id);
        tenant.setActive(true);
        tenant.setSuspensionReason(null);
        tenant.setSuspendedAt(null);
        return tenantRepository.save(tenant);
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
