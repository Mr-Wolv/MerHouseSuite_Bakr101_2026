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
@Table(name = "service_disputes")
public class ServiceDispute {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agreement_id", nullable = false)
    private ServiceAgreement agreement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "statement_id", nullable = false)
    private ServiceStatement statement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "statement_line_id")
    private ServiceStatementLine statementLine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Tenant merchant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_provider_id", nullable = false)
    private Tenant warehouseProvider;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ServiceDisputeStatus status = ServiceDisputeStatus.OPEN;

    @Column(nullable = false, length = 160)
    private String reason;

    @Column(length = 1000)
    private String evidenceNote;

    @Column(length = 1000)
    private String outcomeNote;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant resolvedAt;

    public UUID getId() {
        return id;
    }

    public ServiceAgreement getAgreement() {
        return agreement;
    }

    public void setAgreement(ServiceAgreement agreement) {
        this.agreement = agreement;
    }

    public ServiceStatement getStatement() {
        return statement;
    }

    public void setStatement(ServiceStatement statement) {
        this.statement = statement;
    }

    public ServiceStatementLine getStatementLine() {
        return statementLine;
    }

    public void setStatementLine(ServiceStatementLine statementLine) {
        this.statementLine = statementLine;
    }

    public Tenant getMerchant() {
        return merchant;
    }

    public void setMerchant(Tenant merchant) {
        this.merchant = merchant;
    }

    public Tenant getWarehouseProvider() {
        return warehouseProvider;
    }

    public void setWarehouseProvider(Tenant warehouseProvider) {
        this.warehouseProvider = warehouseProvider;
    }

    public ServiceDisputeStatus getStatus() {
        return status;
    }

    public void setStatus(ServiceDisputeStatus status) {
        this.status = status;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getEvidenceNote() {
        return evidenceNote;
    }

    public void setEvidenceNote(String evidenceNote) {
        this.evidenceNote = evidenceNote;
    }

    public String getOutcomeNote() {
        return outcomeNote;
    }

    public void setOutcomeNote(String outcomeNote) {
        this.outcomeNote = outcomeNote;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }
}
