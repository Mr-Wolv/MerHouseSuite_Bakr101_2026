package com.merhouse.dto;

public record PasswordResetRequestResponse(
    String message,
    String resetToken,
    String resetPath
) {
}
