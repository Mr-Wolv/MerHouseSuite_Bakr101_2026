package com.merhouse.config;

import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import jakarta.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Initializes the Firebase Admin SDK on application startup.
 *
 * <p>In local development with the Firebase Auth emulator, the
 * {@code FIREBASE_EMULATOR_HOST} environment variable is set and no
 * real credentials are required. In production, a service-account
 * JSON is provided via {@code FIREBASE_SERVICE_ACCOUNT_JSON} or
 * {@code GOOGLE_APPLICATION_CREDENTIALS}.
 */
@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @Value("${firebase.service-account-json:}")
    private String serviceAccountJson;

    @Value("${firebase.project-id:}")
    private String projectId;

    @PostConstruct
    public void init() {
        if (FirebaseApp.getApps().isEmpty()) {
            String emulatorHost = System.getenv("FIREBASE_EMULATOR_HOST");
            if (emulatorHost != null && !emulatorHost.isBlank()) {
                log.info("Firebase Auth emulator detected at {} — initializing with emulator credentials.", emulatorHost);
                // The Firebase Admin SDK requires setCredentials() even for emulator mode,
                // and the credentials must support token refresh. The emulator never
                // validates tokens, so we provide a fake credential that returns a
                // static access token on every refresh.
                GoogleCredentials emulatorCredentials = new GoogleCredentials(
                    new AccessToken("emulator", Date.from(java.time.Instant.now().plusSeconds(3600)))
                ) {
                    @Override
                    public AccessToken refreshAccessToken() {
                        return new AccessToken("emulator",
                            Date.from(java.time.Instant.now().plusSeconds(3600)));
                    }
                };
                FirebaseOptions options = FirebaseOptions.builder()
                    .setProjectId(projectId != null && !projectId.isBlank() ? projectId : "merhouse-local")
                    .setCredentials(emulatorCredentials)
                    .build();
                FirebaseApp.initializeApp(options);
                return;
            }

            if (serviceAccountJson != null && !serviceAccountJson.isBlank()) {
                try {
                    FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(
                            GoogleCredentials.fromStream(
                                new ByteArrayInputStream(serviceAccountJson.getBytes(StandardCharsets.UTF_8))
                            )
                        )
                        .build();
                    FirebaseApp.initializeApp(options);
                    log.info("Firebase Admin SDK initialized with service-account JSON.");
                } catch (IOException e) {
                    throw new IllegalStateException("Failed to initialize Firebase Admin SDK from service-account JSON.", e);
                }
            } else {
                try {
                    FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.getApplicationDefault())
                        .build();
                    FirebaseApp.initializeApp(options);
                    log.info("Firebase Admin SDK initialized with Application Default Credentials.");
                } catch (IOException e) {
                    throw new IllegalStateException(
                        "Firebase Admin SDK could not be initialized. " +
                        "Set FIREBASE_EMULATOR_HOST for local dev or provide FIREBASE_SERVICE_ACCOUNT_JSON for production.",
                        e
                    );
                }
            }
        }
    }

    /**
     * Expose a {@link FirebaseAuth} bean so services like {@code UserService}
     * can inject it via {@code ObjectProvider<FirebaseAuth>} and create
     * Firebase Auth users alongside database users.
     */
    @Bean
    FirebaseAuth firebaseAuth() {
        return FirebaseAuth.getInstance();
    }
}
