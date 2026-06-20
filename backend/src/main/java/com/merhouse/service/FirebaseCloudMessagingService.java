package com.merhouse.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.WebpushConfig;
import com.google.firebase.messaging.WebpushNotification;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Utility service for sending outbound notifications via Firebase Cloud
 * Messaging (FCM).
 *
 * <p>FCM is included in the Spark (free) plan with unlimited message volume.
 * This service maps user target tokens (stored in notification_preferences or
 * a dedicated fcm_tokens table) to outbound push notifications.
 *
 * <p>Tokens are registered by the frontend using the Firebase Messaging SDK
 * when the user grants notification permission. The backend stores these
 * tokens and uses them to send targeted notifications (account lifecycle,
 * operations, service accountability, outbox health).
 *
 * <p>If FCM is not configured (no tokens available), the service logs a
 * warning and returns without sending — the existing in-app notification
 * delivery remains the primary channel.
 */
@Service
public class FirebaseCloudMessagingService {

    private static final Logger log = LoggerFactory.getLogger(FirebaseCloudMessagingService.class);

    private final boolean enabled;

    public FirebaseCloudMessagingService(
        @Value("${merhouse.firebase.fcm.enabled:false}") boolean enabled
    ) {
        this.enabled = enabled;
    }

    /**
     * Send a notification to a single FCM device/web token.
     *
     * @param fcmToken  The target device/web registration token.
     * @param title     Notification title.
     * @param body      Notification body text.
     * @param data      Optional key-value data payload for the frontend handler.
     * @return {@code true} if the message was sent successfully.
     */
    public boolean sendNotification(String fcmToken, String title, String body, Map<String, String> data) {
        if (!enabled || fcmToken == null || fcmToken.isBlank()) {
            log.debug("FCM disabled or no token provided — skipping push notification.");
            return false;
        }

        try {
            Notification notification = Notification.builder()
                .setTitle(title)
                .setBody(body)
                .build();

            WebpushConfig webpushConfig = WebpushConfig.builder()
                .setNotification(WebpushNotification.builder()
                    .setTitle(title)
                    .setBody(body)
                    .build())
                .build();

            Message message = Message.builder()
                .setNotification(notification)
                .setWebpushConfig(webpushConfig)
                .putAllData(data != null ? data : Map.of())
                .setToken(fcmToken)
                .build();

            String messageId = FirebaseMessaging.getInstance().send(message);
            log.info("FCM notification sent: {} / messageId={}", title, messageId);
            return true;
        } catch (FirebaseMessagingException e) {
            log.warn("FCM send failed for '{}': {} (code={})", title, e.getMessage(), e.getErrorCode());
            return false;
        }
    }

    /**
     * Convenience method for sending a notification without custom data.
     */
    public boolean sendNotification(String fcmToken, String title, String body) {
        return sendNotification(fcmToken, title, body, Map.of());
    }
}
