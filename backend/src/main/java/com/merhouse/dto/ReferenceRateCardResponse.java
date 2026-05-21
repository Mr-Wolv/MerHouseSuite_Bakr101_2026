package com.merhouse.dto;

import com.merhouse.entity.ReferenceRateCard;
import java.math.BigDecimal;

public record ReferenceRateCardResponse(
    BigDecimal inboundReceivingFeePerUnit,
    BigDecimal storageFeePerUnitPerDay,
    int freeStorageDays,
    BigDecimal minimumMonthlyServiceCharge,
    BigDecimal pickFeePerOrder,
    BigDecimal pickFeePerLine,
    BigDecimal packFeePerOrder,
    BigDecimal packagingFeePerPackage,
    BigDecimal shipmentHandlingFee,
    BigDecimal returnRestockFee,
    BigDecimal exceptionHandlingFee,
    BigDecimal coordinationFeePercent,
    BigDecimal fixedCoordinationFee,
    String carrierPassThroughNote
) {
    public static ReferenceRateCardResponse from(ReferenceRateCard card) {
        return new ReferenceRateCardResponse(
            card.getInboundReceivingFeePerUnit(),
            card.getStorageFeePerUnitPerDay(),
            card.getFreeStorageDays(),
            card.getMinimumMonthlyServiceCharge(),
            card.getPickFeePerOrder(),
            card.getPickFeePerLine(),
            card.getPackFeePerOrder(),
            card.getPackagingFeePerPackage(),
            card.getShipmentHandlingFee(),
            card.getReturnRestockFee(),
            card.getExceptionHandlingFee(),
            card.getCoordinationFeePercent(),
            card.getFixedCoordinationFee(),
            card.getCarrierPassThroughNote()
        );
    }
}
