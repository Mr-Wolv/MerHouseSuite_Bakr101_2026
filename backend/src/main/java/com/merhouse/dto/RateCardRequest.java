package com.merhouse.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record RateCardRequest(
    @DecimalMin("0.00") BigDecimal inboundReceivingFeePerUnit,
    @DecimalMin("0.00") BigDecimal storageFeePerUnitPerDay,
    @Min(0) Integer freeStorageDays,
    @DecimalMin("0.00") BigDecimal minimumMonthlyServiceCharge,
    @DecimalMin("0.00") BigDecimal pickFeePerOrder,
    @DecimalMin("0.00") BigDecimal pickFeePerLine,
    @DecimalMin("0.00") BigDecimal packFeePerOrder,
    @DecimalMin("0.00") BigDecimal packagingFeePerPackage,
    @DecimalMin("0.00") BigDecimal shipmentHandlingFee,
    @DecimalMin("0.00") BigDecimal returnRestockFee,
    @DecimalMin("0.00") BigDecimal exceptionHandlingFee,
    @DecimalMin("0.00") BigDecimal coordinationFeePercent,
    @DecimalMin("0.00") BigDecimal fixedCoordinationFee,
    @Size(max = 500) String carrierPassThroughNote
) {
}
