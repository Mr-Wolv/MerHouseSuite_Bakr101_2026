package com.merhouse.entity;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "order_import_batches")
public class OrderImportBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Tenant merchant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrderImportMode mode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrderImportBatchStatus status;

    @Column(nullable = false, length = 160)
    private String sourceLabel;

    @Column(nullable = false, length = 160)
    private String uploadedBy;

    @Column(nullable = false)
    private int totalRows;

    @Column(nullable = false)
    private int createdRows;

    @Column(nullable = false)
    private int rejectedRows;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<OrderImportRow> rows = new LinkedHashSet<>();

    public UUID getId() {
        return id;
    }

    public Tenant getMerchant() {
        return merchant;
    }

    public void setMerchant(Tenant merchant) {
        this.merchant = merchant;
    }

    public OrderImportMode getMode() {
        return mode;
    }

    public void setMode(OrderImportMode mode) {
        this.mode = mode;
    }

    public OrderImportBatchStatus getStatus() {
        return status;
    }

    public void setStatus(OrderImportBatchStatus status) {
        this.status = status;
    }

    public String getSourceLabel() {
        return sourceLabel;
    }

    public void setSourceLabel(String sourceLabel) {
        this.sourceLabel = sourceLabel;
    }

    public String getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(String uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public int getTotalRows() {
        return totalRows;
    }

    public void setTotalRows(int totalRows) {
        this.totalRows = totalRows;
    }

    public int getCreatedRows() {
        return createdRows;
    }

    public void setCreatedRows(int createdRows) {
        this.createdRows = createdRows;
    }

    public int getRejectedRows() {
        return rejectedRows;
    }

    public void setRejectedRows(int rejectedRows) {
        this.rejectedRows = rejectedRows;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Set<OrderImportRow> getRows() {
        return rows;
    }

    public void addRow(OrderImportRow row) {
        row.setBatch(this);
        rows.add(row);
    }
}
