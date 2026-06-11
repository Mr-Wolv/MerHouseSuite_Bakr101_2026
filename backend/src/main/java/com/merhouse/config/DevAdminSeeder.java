package com.merhouse.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.merhouse.dto.CreateTenantRequest;
import com.merhouse.dto.CreateUserRequest;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.service.TenantService;
import com.merhouse.service.UserService;

@Configuration
public class DevAdminSeeder {
    @Bean
    ApplicationRunner seedAdminUser(
        AppUserRepository userRepository,
        TenantService tenantService,
        UserService userService,
        @Value("${merhouse.auth.seed-admin.enabled:false}") boolean enabled,
        @Value("${merhouse.auth.seed-admin.email:}") String email,
        @Value("${merhouse.auth.seed-admin.password:}") String password
    ) {
        return arguments -> {
            if (!enabled) {
                return;
            }
            if (email == null || email.isBlank() || password == null || password.isBlank()) {
                throw new IllegalStateException("Seed admin is enabled, but email or password is missing.");
            }

            userRepository.findByEmailIgnoreCase(email).ifPresentOrElse(existing -> {
                if (!existing.isEnabled()) {
                    existing.setEnabled(true);
                    userRepository.save(existing);
                }
            }, () -> {
                Tenant tenant = tenantService.create(new CreateTenantRequest("Platform Admin", TenantType.WAREHOUSE_PROVIDER));
                userService.create(new CreateUserRequest(tenant.getId(), email, password, UserRole.OWNER));
            });
        };
    }
}
