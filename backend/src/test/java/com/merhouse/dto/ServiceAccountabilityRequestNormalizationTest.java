package com.merhouse.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.merhouse.entity.ServiceClaimStatus;
import com.merhouse.entity.ServiceDisputeStatus;
import com.merhouse.entity.ServiceReviewStatus;
import com.merhouse.entity.ServiceReviewType;
import com.merhouse.entity.ServiceScope;
import com.merhouse.entity.ServiceSourceType;
import com.merhouse.entity.ServiceStatementLineType;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ServiceAccountabilityRequestNormalizationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void agreementTermsTrimCopiedTextBeforeValidation() {
        var rateCard = new RateCardRequest(
            BigDecimal.ONE,
            BigDecimal.ONE,
            3,
            BigDecimal.TEN,
            BigDecimal.ONE,
            BigDecimal.ONE,
            BigDecimal.ONE,
            BigDecimal.ONE,
            BigDecimal.ONE,
            BigDecimal.ONE,
            BigDecimal.ONE,
            BigDecimal.ONE,
            BigDecimal.ZERO,
            " Carrier bills separately "
        );
        var slaPolicy = new SlaPolicyRequest(24, 12, 6, 4, " Pause during partner hold ");
        var request = new CreateServiceAgreementRequest(
            UUID.randomUUID(),
            " Standard terms ",
            LocalDate.now().plusDays(1),
            null,
            30,
            List.of(ServiceScope.INBOUND_RECEIVING),
            " Connected service notes ",
            null,
            rateCard,
            slaPolicy
        );

        assertTrue(validator.validate(request).isEmpty());
        assertEquals("Standard terms", request.title());
        assertEquals("Connected service notes", request.serviceNotes());
        assertEquals("Carrier bills separately", request.rateCard().carrierPassThroughNote());
        assertEquals("Pause during partner hold", request.slaPolicy().pauseRuleNotes());
    }

    @Test
    void statementRequestsTrimNotesKeysAndLineDescriptionsBeforeValidation() {
        LocalDate periodStart = LocalDate.now().plusDays(1);
        var line = new ServiceStatementLineRequest(
            ServiceStatementLineType.RECEIVING,
            ServiceSourceType.INBOUND_STOCK_REQUEST,
            UUID.randomUUID(),
            " Inbound service line ",
            4,
            BigDecimal.ONE
        );
        var createRequest = new CreateServiceStatementRequest(
            periodStart,
            periodStart.plusDays(1),
            periodStart.plusDays(2),
            " statement-key ",
            " Service period note ",
            List.of(line)
        );
        var generateRequest = new GenerateServiceStatementRequest(
            periodStart,
            periodStart.plusDays(1),
            periodStart.plusDays(2),
            " generated-key ",
            " Generated statement note ",
            List.of(UUID.randomUUID()),
            List.of(UUID.randomUUID()),
            List.of(UUID.randomUUID())
        );

        assertTrue(validator.validate(createRequest).isEmpty());
        assertEquals("statement-key", createRequest.idempotencyKey());
        assertEquals("Service period note", createRequest.note());
        assertEquals("Inbound service line", createRequest.lines().get(0).description());
        assertTrue(validator.validate(generateRequest).isEmpty());
        assertEquals("generated-key", generateRequest.idempotencyKey());
        assertEquals("Generated statement note", generateRequest.note());
    }

    @Test
    void issueRequestsTrimReasonsEvidenceAndOutcomesBeforeValidation() {
        var dispute = new CreateServiceDisputeRequest(UUID.randomUUID(), " Handoff mismatch ", " Carrier note ");
        var disputeResolution = new ResolveServiceDisputeRequest(ServiceDisputeStatus.RESOLVED, " Accepted adjustment ");
        var claim = new CreateServiceClaimRequest(ServiceSourceType.SHIPMENT, UUID.randomUUID(), " DAMAGED_ITEM ", " Damaged package ", " Receiver photo ");
        var claimResolution = new ResolveServiceClaimRequest(ServiceClaimStatus.REJECTED, " Claim denied ");
        var review = new CreateServiceReviewRequest(ServiceReviewType.MANUAL_ADJUSTMENT, " Manual adjustment ", " Audit evidence ");
        var reviewResolution = new ResolveServiceReviewRequest(ServiceReviewStatus.APPROVED, " Approved after review ");

        assertTrue(validator.validate(dispute).isEmpty());
        assertEquals("Handoff mismatch", dispute.reason());
        assertEquals("Carrier note", dispute.evidenceNote());
        assertEquals("Accepted adjustment", disputeResolution.outcomeNote());
        assertEquals("DAMAGED_ITEM", claim.claimType());
        assertEquals("Damaged package", claim.reason());
        assertEquals("Receiver photo", claim.evidenceNote());
        assertEquals("Claim denied", claimResolution.outcomeNote());
        assertEquals("Manual adjustment", review.reason());
        assertEquals("Audit evidence", review.evidenceNote());
        assertEquals("Approved after review", reviewResolution.outcomeNote());
    }

    @Test
    void optionalWhitespaceOnlyNotesNormalizeToNull() {
        var dispute = new CreateServiceDisputeRequest(null, " Count mismatch ", "   ");
        var statement = new CreateServiceStatementRequest(
            LocalDate.now().plusDays(1),
            LocalDate.now().plusDays(2),
            LocalDate.now().plusDays(3),
            "   ",
            "   ",
            List.of(new ServiceStatementLineRequest(
                ServiceStatementLineType.CREDIT,
                ServiceSourceType.SHIPMENT,
                null,
                " Adjustment ",
                1,
                BigDecimal.ZERO
            ))
        );

        assertNull(dispute.evidenceNote());
        assertNull(statement.idempotencyKey());
        assertNull(statement.note());
    }
}
