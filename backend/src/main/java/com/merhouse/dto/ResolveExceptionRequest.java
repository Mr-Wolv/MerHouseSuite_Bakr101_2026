package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResolveExceptionRequest(
    @NotBlank @Size(max = 1000) String resolutionNote
) {
}
