package com.merhouse.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "shipment_packages")
public class ShipmentPackage {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shipment_id", nullable = false)
    private Shipment shipment;

    @Column(nullable = false)
    private int packageNumber;

    @Column(nullable = false, length = 120)
    private String labelCode;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal weightKg;

    @Column(nullable = false)
    private int lengthCm;

    @Column(nullable = false)
    private int widthCm;

    @Column(nullable = false)
    private int heightCm;

    @Column(nullable = false, length = 32)
    private String status = "PACKED";

    @OneToMany(mappedBy = "shipmentPackage", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<ShipmentPackageEvent> events = new LinkedHashSet<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public UUID getId() { return id; }
    public Shipment getShipment() { return shipment; }
    public void setShipment(Shipment shipment) { this.shipment = shipment; }
    public int getPackageNumber() { return packageNumber; }
    public void setPackageNumber(int packageNumber) { this.packageNumber = packageNumber; }
    public String getLabelCode() { return labelCode; }
    public void setLabelCode(String labelCode) { this.labelCode = labelCode; }
    public BigDecimal getWeightKg() { return weightKg; }
    public void setWeightKg(BigDecimal weightKg) { this.weightKg = weightKg; }
    public int getLengthCm() { return lengthCm; }
    public void setLengthCm(int lengthCm) { this.lengthCm = lengthCm; }
    public int getWidthCm() { return widthCm; }
    public void setWidthCm(int widthCm) { this.widthCm = widthCm; }
    public int getHeightCm() { return heightCm; }
    public void setHeightCm(int heightCm) { this.heightCm = heightCm; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Set<ShipmentPackageEvent> getEvents() { return events; }
    public Instant getCreatedAt() { return createdAt; }

    public void addEvent(ShipmentPackageEvent event) {
        event.setShipmentPackage(this);
        events.add(event);
    }
}
