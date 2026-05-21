package com.merhouse.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "inventory_audit_logs")
public class InventoryAuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inventory_item_id", nullable = false)
    private InventoryItem inventoryItem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 48)
    private InventoryAuditAction action;

    @Column(nullable = false)
    private int beforeQuantity;

    @Column(nullable = false)
    private int afterQuantity;

    @Column(nullable = false)
    private int beforeReservedQuantity;

    @Column(nullable = false)
    private int afterReservedQuantity;

    @Column(length = 80)
    private String reasonCode;

    @Column(length = 500)
    private String reasonNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id")
    private AppUser actorUser;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant occurredAt;

    public UUID getId() {
        return id;
    }

    public Warehouse getWarehouse() {
        return warehouse;
    }

    public void setWarehouse(Warehouse warehouse) {
        this.warehouse = warehouse;
    }

    public InventoryItem getInventoryItem() {
        return inventoryItem;
    }

    public void setInventoryItem(InventoryItem inventoryItem) {
        this.inventoryItem = inventoryItem;
    }

    public InventoryAuditAction getAction() {
        return action;
    }

    public void setAction(InventoryAuditAction action) {
        this.action = action;
    }

    public int getBeforeQuantity() {
        return beforeQuantity;
    }

    public void setBeforeQuantity(int beforeQuantity) {
        this.beforeQuantity = beforeQuantity;
    }

    public int getAfterQuantity() {
        return afterQuantity;
    }

    public void setAfterQuantity(int afterQuantity) {
        this.afterQuantity = afterQuantity;
    }

    public int getBeforeReservedQuantity() {
        return beforeReservedQuantity;
    }

    public void setBeforeReservedQuantity(int beforeReservedQuantity) {
        this.beforeReservedQuantity = beforeReservedQuantity;
    }

    public int getAfterReservedQuantity() {
        return afterReservedQuantity;
    }

    public void setAfterReservedQuantity(int afterReservedQuantity) {
        this.afterReservedQuantity = afterReservedQuantity;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public void setReasonCode(String reasonCode) {
        this.reasonCode = reasonCode;
    }

    public String getReasonNote() {
        return reasonNote;
    }

    public void setReasonNote(String reasonNote) {
        this.reasonNote = reasonNote;
    }

    public AppUser getActorUser() {
        return actorUser;
    }

    public void setActorUser(AppUser actorUser) {
        this.actorUser = actorUser;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
