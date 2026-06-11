package com.merhouse.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminRequestNormalizationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void adminCreateRequestsTrimCopiedTextBeforeValidation() {
        UUID tenantId = UUID.randomUUID();

        var user = new CreateUserRequest(tenantId, " operator@merhouse.local ", " exact password ", UserRole.WAREHOUSE_OPERATOR);
        var tenant = new CreateTenantRequest(" New Merchant ", TenantType.MERCHANT);
        var warehouse = new CreateWarehouseRequest(tenantId, " Cairo Dock ", " Cairo Dock 1 ", null, null, 120);

        assertTrue(validator.validate(user).isEmpty());
        assertEquals("operator@merhouse.local", user.email());
        assertEquals(" exact password ", user.password());
        assertTrue(validator.validate(tenant).isEmpty());
        assertEquals("New Merchant", tenant.name());
        assertTrue(validator.validate(warehouse).isEmpty());
        assertEquals("Cairo Dock", warehouse.name());
        assertEquals("Cairo Dock 1", warehouse.address());
    }

    @Test
    void adminActionRequestsTrimReasonsWithoutChangingPasswords() {
        var action = new AdminActionRequest(" Governance review ");
        var reset = new AdminResetPasswordRequest(" exact reset password ", " Support recovery ");
        var roleChange = new ChangeUserRoleRequest(UserRole.MERCHANT, " Role correction ");

        assertTrue(validator.validate(action).isEmpty());
        assertEquals("Governance review", action.reason());
        assertTrue(validator.validate(reset).isEmpty());
        assertEquals(" exact reset password ", reset.newPassword());
        assertEquals("Support recovery", reset.reason());
        assertTrue(validator.validate(roleChange).isEmpty());
        assertEquals("Role correction", roleChange.reason());
    }
}
