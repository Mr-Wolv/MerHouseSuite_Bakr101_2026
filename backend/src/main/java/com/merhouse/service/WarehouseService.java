package com.merhouse.service;

import com.merhouse.dto.CreateWarehouseRequest;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.Warehouse;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.WarehouseRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WarehouseService {
    private final TenantService tenantService;
    private final WarehouseRepository warehouseRepository;
    private final CurrentUserService currentUserService;

    public WarehouseService(
        TenantService tenantService,
        WarehouseRepository warehouseRepository,
        CurrentUserService currentUserService
    ) {
        this.tenantService = tenantService;
        this.warehouseRepository = warehouseRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public Warehouse create(CreateWarehouseRequest request) {
        Tenant tenant = tenantService.getRequired(request.tenantId());
        Warehouse warehouse = new Warehouse();
        warehouse.setTenant(tenant);
        warehouse.setName(request.name().trim());
        warehouse.setAddress(request.address().trim());
        warehouse.setLatitude(request.latitude());
        warehouse.setLongitude(request.longitude());
        warehouse.setCapacity(request.capacity());
        return warehouseRepository.save(warehouse);
    }

    @Transactional(readOnly = true)
    public List<Warehouse> findAll(UUID tenantId) {
        if (!currentUserService.isAdmin()) {
            UUID currentTenantId = currentUserService.required().tenantId();
            if (tenantId != null && !tenantId.equals(currentTenantId)) {
                currentUserService.requireAdminOrTenant(tenantId);
            }
            return warehouseRepository.findByTenantId(currentTenantId);
        }

        if (tenantId == null) {
            return warehouseRepository.findAll();
        }
        return warehouseRepository.findByTenantId(tenantId);
    }

    @Transactional(readOnly = true)
    public Warehouse getRequired(UUID id) {
        return warehouseRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found: " + id));
    }
}
