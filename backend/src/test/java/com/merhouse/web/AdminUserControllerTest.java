package com.merhouse.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.merhouse.dto.AdminActionRequest;
import com.merhouse.dto.AdminResetPasswordRequest;
import com.merhouse.dto.ChangeUserRoleRequest;
import java.lang.reflect.Method;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

class AdminUserControllerTest {
    @Test
    void roleManagementMutationsRequirePlatformMutationPermissionAtTheControllerBoundary() throws Exception {
        assertEquals("@currentUserService.canMutatePlatform()", preAuthorize("disable", UUID.class, AdminActionRequest.class));
        assertEquals("@currentUserService.canMutatePlatform()", preAuthorize("enable", UUID.class, AdminActionRequest.class));
        assertEquals("@currentUserService.canMutatePlatform()", preAuthorize("changeRole", UUID.class, ChangeUserRoleRequest.class));
    }

    @Test
    void supportPasswordResetStaysAvailableBelowPlatformMutationPermission() throws Exception {
        assertNotEquals(
            "@currentUserService.canMutatePlatform()",
            preAuthorize("resetPassword", UUID.class, AdminResetPasswordRequest.class)
        );
    }

    private String preAuthorize(String methodName, Class<?>... parameterTypes) throws Exception {
        Method method = AdminUserController.class.getMethod(methodName, parameterTypes);
        PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);
        return annotation == null ? "" : annotation.value();
    }
}
