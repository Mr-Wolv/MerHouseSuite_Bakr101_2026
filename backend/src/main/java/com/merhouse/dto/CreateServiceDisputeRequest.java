package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateServiceDisputeRequest(
    UUID statementLineId,
    @NotBlank @Size(max = 160) String reason,
    @Size(max = 1000) String evidenceNote
) {
}
