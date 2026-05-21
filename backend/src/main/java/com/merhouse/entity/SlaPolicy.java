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
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "sla_policies")
public class SlaPolicy {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agreement_id", nullable = false, unique = true)
    private ServiceAgreement agreement;

    @Column(nullable = false)
    private int receivingSlaHours;

    @Column(nullable = false)
    private int pickPackSlaHours;

    @Column(nullable = false)
    private int shipmentHandoffSlaHours;

    @Column(nullable = false)
    private int exceptionResponseSlaHours;

    @Column(length = 500)
    private String pauseRuleNotes;

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

    public int getReceivingSlaHours() {
        return receivingSlaHours;
    }

    public void setReceivingSlaHours(int receivingSlaHours) {
        this.receivingSlaHours = receivingSlaHours;
    }

    public int getPickPackSlaHours() {
        return pickPackSlaHours;
    }

    public void setPickPackSlaHours(int pickPackSlaHours) {
        this.pickPackSlaHours = pickPackSlaHours;
    }

    public int getShipmentHandoffSlaHours() {
        return shipmentHandoffSlaHours;
    }

    public void setShipmentHandoffSlaHours(int shipmentHandoffSlaHours) {
        this.shipmentHandoffSlaHours = shipmentHandoffSlaHours;
    }

    public int getExceptionResponseSlaHours() {
        return exceptionResponseSlaHours;
    }

    public void setExceptionResponseSlaHours(int exceptionResponseSlaHours) {
        this.exceptionResponseSlaHours = exceptionResponseSlaHours;
    }

    public String getPauseRuleNotes() {
        return pauseRuleNotes;
    }

    public void setPauseRuleNotes(String pauseRuleNotes) {
        this.pauseRuleNotes = pauseRuleNotes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
