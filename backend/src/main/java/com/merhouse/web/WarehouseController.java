package com.merhouse.web;

import com.merhouse.dto.CreateWarehouseRequest;
import com.merhouse.dto.WarehouseResponse;
import com.merhouse.service.WarehouseService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/warehouses")
public class WarehouseController {
    private final WarehouseService warehouseService;

    public WarehouseController(WarehouseService warehouseService) {
        this.warehouseService = warehouseService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public WarehouseResponse create(@Valid @RequestBody CreateWarehouseRequest request) {
        return WarehouseResponse.from(warehouseService.create(request));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'WAREHOUSE_OPERATOR')")
    public List<WarehouseResponse> list(@RequestParam(required = false) UUID tenantId) {
        return warehouseService.findAll(tenantId).stream()
            .map(WarehouseResponse::from)
            .toList();
    }
}
