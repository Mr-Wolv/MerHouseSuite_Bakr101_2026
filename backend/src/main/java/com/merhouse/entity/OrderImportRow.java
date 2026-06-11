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
import java.util.UUID;

@Entity
@Table(name = "order_import_rows")
public class OrderImportRow {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "batch_id", nullable = false)
    private OrderImportBatch batch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_order_id")
    private CustomerOrder createdOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrderImportRowStatus status;

    @Column(nullable = false)
    private int rowNumber;

    @Column(nullable = false, length = 120)
    private String merchantOrderReference;

    @Column(nullable = false, length = 80)
    private String sku;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false, length = 240)
    private String customerAddress;

    @Column(length = 160)
    private String customerName;

    @Column(length = 80)
    private String customerPhone;

    @Column(length = 1000)
    private String failureReason;

    public UUID getId() {
        return id;
    }

    public OrderImportBatch getBatch() {
        return batch;
    }

    public void setBatch(OrderImportBatch batch) {
        this.batch = batch;
    }

    public CustomerOrder getCreatedOrder() {
        return createdOrder;
    }

    public void setCreatedOrder(CustomerOrder createdOrder) {
        this.createdOrder = createdOrder;
    }

    public OrderImportRowStatus getStatus() {
        return status;
    }

    public void setStatus(OrderImportRowStatus status) {
        this.status = status;
    }

    public int getRowNumber() {
        return rowNumber;
    }

    public void setRowNumber(int rowNumber) {
        this.rowNumber = rowNumber;
    }

    public String getMerchantOrderReference() {
        return merchantOrderReference;
    }

    public void setMerchantOrderReference(String merchantOrderReference) {
        this.merchantOrderReference = merchantOrderReference;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public String getCustomerAddress() {
        return customerAddress;
    }

    public void setCustomerAddress(String customerAddress) {
        this.customerAddress = customerAddress;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getCustomerPhone() {
        return customerPhone;
    }

    public void setCustomerPhone(String customerPhone) {
        this.customerPhone = customerPhone;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }
}
