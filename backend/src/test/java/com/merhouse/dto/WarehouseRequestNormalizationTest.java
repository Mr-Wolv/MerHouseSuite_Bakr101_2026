package com.merhouse.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class WarehouseRequestNormalizationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void warehouseShipmentAndWorkloadRequestsTrimCopiedTextBeforeValidation() {
        UUID allocationId = UUID.randomUUID();

        var shipment = new CreateShipmentRequest(
            allocationId,
            " FedEx ",
            " TRACK-123 ",
            2,
            new BigDecimal("4.75"),
            40,
            30,
            20,
            " Packed as two cartons ",
            null
        );
        var workload = new UpdateAllocationWorkloadRequest(null, 1, " SCAN-1 ", true);

        assertTrue(validator.validate(shipment).isEmpty());
        assertEquals("FedEx", shipment.carrier());
        assertEquals("TRACK-123", shipment.trackingNumber());
        assertEquals("Packed as two cartons", shipment.packingNote());
        assertTrue(validator.validate(workload).isEmpty());
        assertEquals("SCAN-1", workload.scanCode());
    }

    @Test
    void warehouseEvidenceRequestsTrimCopiedTextBeforeValidation() {
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID allocationId = UUID.randomUUID();

        var adjustment = new AdjustStockRequest(warehouseId, itemId, -1, " DAMAGED_STOCK ", " Damaged during count ");
        var exception = new ReportExceptionRequest(allocationId, null, " SHORT_PICK ", " Short pick near bay 2 ");
        var received = new ReceiveInboundStockRequest(8, 1, " One carton damaged ");
        var rejected = new RejectInboundStockRequest(" Wrong dock ");

        assertTrue(validator.validate(adjustment).isEmpty());
        assertEquals("DAMAGED_STOCK", adjustment.reasonCode());
        assertEquals("Damaged during count", adjustment.reasonNote());
        assertTrue(validator.validate(exception).isEmpty());
        assertEquals("SHORT_PICK", exception.reasonCode());
        assertEquals("Short pick near bay 2", exception.description());
        assertTrue(validator.validate(received).isEmpty());
        assertEquals("One carton damaged", received.receivingNote());
        assertTrue(validator.validate(rejected).isEmpty());
        assertEquals("Wrong dock", rejected.rejectionReason());
    }
}
