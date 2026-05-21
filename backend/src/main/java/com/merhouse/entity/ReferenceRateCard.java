package com.merhouse.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "reference_rate_cards")
public class ReferenceRateCard {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agreement_id", nullable = false, unique = true)
    private ServiceAgreement agreement;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal inboundReceivingFeePerUnit = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal storageFeePerUnitPerDay = BigDecimal.ZERO;

    @Column(nullable = false)
    private int freeStorageDays;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal minimumMonthlyServiceCharge = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal pickFeePerOrder = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal pickFeePerLine = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal packFeePerOrder = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal packagingFeePerPackage = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal shipmentHandlingFee = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal returnRestockFee = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal exceptionHandlingFee = BigDecimal.ZERO;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal coordinationFeePercent = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal fixedCoordinationFee = BigDecimal.ZERO;

    @Column(length = 500)
    private String carrierPassThroughNote;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public ServiceAgreement getAgreement() {
        return agreement;
    }

    public void setAgreement(ServiceAgreement agreement) {
        this.agreement = agreement;
    }

    public BigDecimal getInboundReceivingFeePerUnit() {
        return inboundReceivingFeePerUnit;
    }

    public void setInboundReceivingFeePerUnit(BigDecimal inboundReceivingFeePerUnit) {
        this.inboundReceivingFeePerUnit = inboundReceivingFeePerUnit;
    }

    public BigDecimal getStorageFeePerUnitPerDay() {
        return storageFeePerUnitPerDay;
    }

    public void setStorageFeePerUnitPerDay(BigDecimal storageFeePerUnitPerDay) {
        this.storageFeePerUnitPerDay = storageFeePerUnitPerDay;
    }

    public int getFreeStorageDays() {
        return freeStorageDays;
    }

    public void setFreeStorageDays(int freeStorageDays) {
        this.freeStorageDays = freeStorageDays;
    }

    public BigDecimal getMinimumMonthlyServiceCharge() {
        return minimumMonthlyServiceCharge;
    }

    public void setMinimumMonthlyServiceCharge(BigDecimal minimumMonthlyServiceCharge) {
        this.minimumMonthlyServiceCharge = minimumMonthlyServiceCharge;
    }

    public BigDecimal getPickFeePerOrder() {
        return pickFeePerOrder;
    }

    public void setPickFeePerOrder(BigDecimal pickFeePerOrder) {
        this.pickFeePerOrder = pickFeePerOrder;
    }

    public BigDecimal getPickFeePerLine() {
        return pickFeePerLine;
    }

    public void setPickFeePerLine(BigDecimal pickFeePerLine) {
        this.pickFeePerLine = pickFeePerLine;
    }

    public BigDecimal getPackFeePerOrder() {
        return packFeePerOrder;
    }

    public void setPackFeePerOrder(BigDecimal packFeePerOrder) {
        this.packFeePerOrder = packFeePerOrder;
    }

    public BigDecimal getPackagingFeePerPackage() {
        return packagingFeePerPackage;
    }

    public void setPackagingFeePerPackage(BigDecimal packagingFeePerPackage) {
        this.packagingFeePerPackage = packagingFeePerPackage;
    }

    public BigDecimal getShipmentHandlingFee() {
        return shipmentHandlingFee;
    }

    public void setShipmentHandlingFee(BigDecimal shipmentHandlingFee) {
        this.shipmentHandlingFee = shipmentHandlingFee;
    }

    public BigDecimal getReturnRestockFee() {
        return returnRestockFee;
    }

    public void setReturnRestockFee(BigDecimal returnRestockFee) {
        this.returnRestockFee = returnRestockFee;
    }

    public BigDecimal getExceptionHandlingFee() {
        return exceptionHandlingFee;
    }

    public void setExceptionHandlingFee(BigDecimal exceptionHandlingFee) {
        this.exceptionHandlingFee = exceptionHandlingFee;
    }

    public BigDecimal getCoordinationFeePercent() {
        return coordinationFeePercent;
    }

    public void setCoordinationFeePercent(BigDecimal coordinationFeePercent) {
        this.coordinationFeePercent = coordinationFeePercent;
    }

    public BigDecimal getFixedCoordinationFee() {
        return fixedCoordinationFee;
    }

    public void setFixedCoordinationFee(BigDecimal fixedCoordinationFee) {
        this.fixedCoordinationFee = fixedCoordinationFee;
    }

    public String getCarrierPassThroughNote() {
        return carrierPassThroughNote;
    }

    public void setCarrierPassThroughNote(String carrierPassThroughNote) {
        this.carrierPassThroughNote = carrierPassThroughNote;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
