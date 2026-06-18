package com.merhouse.config;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(DevAdminSeeder.class);

    @Bean
    ApplicationRunner seedAdminUser(
        AppUserRepository userRepository,
        TenantService tenantService,
        UserService userService,
        @Value("${merhouse.auth.seed-admin.enabled:false}") boolean enabled,
        @Value("${merhouse.auth.seed-admin.email:}") String email,
        @Value("${merhouse.auth.seed-admin.password:}") String password,
        @Value("${firebase.auth.enabled:false}") boolean firebaseEnabled
    ) {
        return arguments -> {
            if (!enabled) {
                return;
            }
            if (email == null || email.isBlank() || password == null || password.isBlank()) {
                throw new IllegalStateException("Seed admin is enabled, but email or password is missing.");
            }

            // --- 1. Ensure the user exists in the database ---
            userRepository.findByEmailIgnoreCase(email).ifPresentOrElse(existing -> {
                if (!existing.isEnabled()) {
                    existing.setEnabled(true);
                    userRepository.save(existing);
                }
            }, () -> {
                Tenant tenant = tenantService.create(new CreateTenantRequest("Platform Admin", TenantType.WAREHOUSE_PROVIDER));
                userService.create(new CreateUserRequest(tenant.getId(), email, password, UserRole.OWNER));
            });

            // --- 2. When Firebase Auth is enabled, also create the user in the
            //     Firebase Auth emulator (or production). The Admin SDK
            //     automatically targets the emulator when FIREBASE_EMULATOR_HOST
            //     is set. If the user already exists this is a no-op.
            //     Wrapped in try-catch so a Firebase failure never prevents the
            //     DB user from being seeded. ---
            if (firebaseEnabled) {
                try {
                    try {
                        FirebaseAuth.getInstance().getUserByEmail(email);
                        log.debug("Firebase Auth user already exists for {} — skipping creation.", email);
                    } catch (FirebaseAuthException e) {
                        // User not found — create it.
                        UserRecord.CreateRequest createRequest = new UserRecord.CreateRequest()
                            .setEmail(email)
                            .setPassword(password)
                            .setEmailVerified(true);
                        FirebaseAuth.getInstance().createUser(createRequest);
                        log.info("Created Firebase Auth user for seed admin: {}", email);
                    }
                } catch (Exception ex) {
                    log.warn("Firebase Auth user seeding failed for {}: {} — DB user was still created.", email, ex.getMessage());
                }
            }
        };
    }
}
