package com.merhouse.web;

import com.merhouse.dto.MessageResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.FcmToken;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.FcmTokenRepository;
import com.merhouse.service.CurrentUserService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class FcmTokenController {

    private final FcmTokenRepository fcmTokenRepository;
    private final AppUserRepository userRepository;
    private final CurrentUserService currentUserService;

    public FcmTokenController(
        FcmTokenRepository fcmTokenRepository,
        AppUserRepository userRepository,
        CurrentUserService currentUserService
    ) {
        this.fcmTokenRepository = fcmTokenRepository;
        this.userRepository = userRepository;
        this.currentUserService = currentUserService;
    }

    private AppUser resolveCurrentUser() {
        return userRepository.findById(currentUserService.required().id())
            .orElseThrow(() -> new ResourceNotFoundException("Current user not found."));
    }

    /**
     * Register or update the FCM push notification token for the current user.
     * Each user can have one active token; calling this replaces any existing token.
     */
    @PostMapping("/fcm-tokens")
    public MessageResponse registerFcmToken(@RequestBody FcmTokenRequest request) {
        AppUser user = resolveCurrentUser();
        fcmTokenRepository.findByUserId(user.getId())
            .ifPresentOrElse(
                existing -> {
                    existing.setFcmToken(request.fcmToken());
                    fcmTokenRepository.save(existing);
                },
                () -> {
                    FcmToken token = new FcmToken();
                    token.setUser(user);
                    token.setFcmToken(request.fcmToken());
                    fcmTokenRepository.save(token);
                }
            );
        return new MessageResponse("FCM token registered.");
    }

    /**
     * Remove the FCM push notification token for the current user.
     */
    @DeleteMapping("/fcm-tokens")
    public MessageResponse unregisterFcmToken() {
        fcmTokenRepository.deleteByUserId(currentUserService.required().id());
        return new MessageResponse("FCM token removed.");
    }

    public record FcmTokenRequest(String fcmToken) {}
}
