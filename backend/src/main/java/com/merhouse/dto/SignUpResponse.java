package com.merhouse.dto;

public record SignUpResponse(
    UserResponse user,
    String recoveryKey
) {
}
