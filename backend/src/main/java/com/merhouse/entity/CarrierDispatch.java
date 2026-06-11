package com.merhouse.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "carrier_dispatches")
public class CarrierDispatch {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID outboxEventId;

    @Column(nullable = false)
    private UUID shipmentId;

    @Column(nullable = false, length = 120)
    private String eventType;

    @Column(length = 120)
    private String carrier;

    @Column(length = 160)
    private String trackingNumber;

    @Column(nullable = false, length = 32)
    private String status = "DISPATCHED";

    @Column(nullable = false)
    private int attempts = 1;

    @Column(nullable = false, length = 160)
    private String externalReference;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public UUID getOutboxEventId() {
        return outboxEventId;
    }

    public void setOutboxEventId(UUID outboxEventId) {
        this.outboxEventId = outboxEventId;
    }

    public UUID getShipmentId() {
        return shipmentId;
    }

    public void setShipmentId(UUID shipmentId) {
        this.shipmentId = shipmentId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getCarrier() {
        return carrier;
    }

    public void setCarrier(String carrier) {
        this.carrier = carrier;
    }

    public String getTrackingNumber() {
        return trackingNumber;
    }

    public void setTrackingNumber(String trackingNumber) {
        this.trackingNumber = trackingNumber;
    }

    public String getStatus() {
        return status;
    }

    public int getAttempts() {
        return attempts;
    }

    public String getExternalReference() {
        return externalReference;
    }

    public void setExternalReference(String externalReference) {
        this.externalReference = externalReference;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
