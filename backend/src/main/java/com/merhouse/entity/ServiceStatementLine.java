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
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "service_statement_lines")
public class ServiceStatementLine {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "statement_id", nullable = false)
    private ServiceStatement statement;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ServiceStatementLineType lineType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ServiceSourceType sourceType;

    private UUID sourceId;

    @Column(nullable = false, length = 240)
    private String description;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal lineAmount = BigDecimal.ZERO;

    public UUID getId() {
        return id;
    }

    public ServiceStatement getStatement() {
        return statement;
    }

    public void setStatement(ServiceStatement statement) {
        this.statement = statement;
    }

    public ServiceStatementLineType getLineType() {
        return lineType;
    }

    public void setLineType(ServiceStatementLineType lineType) {
        this.lineType = lineType;
    }

    public ServiceSourceType getSourceType() {
        return sourceType;
    }

    public void setSourceType(ServiceSourceType sourceType) {
        this.sourceType = sourceType;
    }

    public UUID getSourceId() {
        return sourceId;
    }

    public void setSourceId(UUID sourceId) {
        this.sourceId = sourceId;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getUnitAmount() {
        return unitAmount;
    }

    public void setUnitAmount(BigDecimal unitAmount) {
        this.unitAmount = unitAmount;
    }

    public BigDecimal getLineAmount() {
        return lineAmount;
    }

    public void setLineAmount(BigDecimal lineAmount) {
        this.lineAmount = lineAmount;
    }
}
