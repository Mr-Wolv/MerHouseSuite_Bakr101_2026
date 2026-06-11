package com.merhouse.dto;

import jakarta.validation.constraints.Size;

public record AccessRequestReviewRequest(
    @Size(max = 1000) String reviewNote
) {
}
