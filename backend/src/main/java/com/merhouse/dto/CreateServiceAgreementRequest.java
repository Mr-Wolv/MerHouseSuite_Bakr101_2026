package com.merhouse.dto;

import com.merhouse.entity.ServiceScope;
import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CreateServiceAgreementRequest(
    @NotNull UUID relationshipId,
    @NotBlank @Size(max = 160) String title,
    @NotNull @FutureOrPresent LocalDate effectiveDate,
    LocalDate renewalReviewDate,
    @Min(0) Integer cancellationWindowDays,
    @NotEmpty List<ServiceScope> serviceScopes,
    @Size(max = 1000) String serviceNotes,
    UUID supersedesAgreementId,
    @Valid RateCardRequest rateCard,
    @Valid SlaPolicyRequest slaPolicy
) {
    public CreateServiceAgreementRequest {
        title = trim(title);
        serviceNotes = trimToNull(serviceNotes);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static String trimToNull(String value) {
        String trimmed = trim(value);
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }
}
