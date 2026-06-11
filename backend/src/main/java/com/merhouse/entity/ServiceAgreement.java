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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "service_agreements")
public class ServiceAgreement {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "relationship_id", nullable = false)
    private MerchantWarehouseRelationship relationship;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Tenant merchant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_provider_id", nullable = false)
    private Tenant warehouseProvider;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ServiceAgreementStatus status;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false)
    private int versionNumber;

    @Column(nullable = false)
    private LocalDate effectiveDate;

    private LocalDate renewalReviewDate;

    @Column(nullable = false)
    private int cancellationWindowDays;

    @Column(nullable = false, length = 500)
    private String serviceScopes;

    @Column(length = 1000)
    private String serviceNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supersedes_agreement_id")
    private ServiceAgreement supersedesAgreement;

    @OneToOne(mappedBy = "agreement", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private ReferenceRateCard rateCard;

    @OneToOne(mappedBy = "agreement", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private SlaPolicy slaPolicy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant proposedAt;
    private Instant acceptedAt;
    private Instant activatedAt;
    private Instant suspendedAt;
    private Instant endedAt;

    public UUID getId() {
        return id;
    }

    public MerchantWarehouseRelationship getRelationship() {
        return relationship;
    }

    public void setRelationship(MerchantWarehouseRelationship relationship) {
        this.relationship = relationship;
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

    public ServiceAgreementStatus getStatus() {
        return status;
    }

    public void setStatus(ServiceAgreementStatus status) {
        this.status = status;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getVersionNumber() {
        return versionNumber;
    }

    public void setVersionNumber(int versionNumber) {
        this.versionNumber = versionNumber;
    }

    public LocalDate getEffectiveDate() {
        return effectiveDate;
    }

    public void setEffectiveDate(LocalDate effectiveDate) {
        this.effectiveDate = effectiveDate;
    }

    public LocalDate getRenewalReviewDate() {
        return renewalReviewDate;
    }

    public void setRenewalReviewDate(LocalDate renewalReviewDate) {
        this.renewalReviewDate = renewalReviewDate;
    }

    public int getCancellationWindowDays() {
        return cancellationWindowDays;
    }

    public void setCancellationWindowDays(int cancellationWindowDays) {
        this.cancellationWindowDays = cancellationWindowDays;
    }

    public String getServiceScopes() {
        return serviceScopes;
    }

    public void setServiceScopes(String serviceScopes) {
        this.serviceScopes = serviceScopes;
    }

    public String getServiceNotes() {
        return serviceNotes;
    }

    public void setServiceNotes(String serviceNotes) {
        this.serviceNotes = serviceNotes;
    }

    public ServiceAgreement getSupersedesAgreement() {
        return supersedesAgreement;
    }

    public void setSupersedesAgreement(ServiceAgreement supersedesAgreement) {
        this.supersedesAgreement = supersedesAgreement;
    }

    public ReferenceRateCard getRateCard() {
        return rateCard;
    }

    public void setRateCard(ReferenceRateCard rateCard) {
        this.rateCard = rateCard;
        if (rateCard != null) {
            rateCard.setAgreement(this);
        }
    }

    public SlaPolicy getSlaPolicy() {
        return slaPolicy;
    }

    public void setSlaPolicy(SlaPolicy slaPolicy) {
        this.slaPolicy = slaPolicy;
        if (slaPolicy != null) {
            slaPolicy.setAgreement(this);
        }
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getProposedAt() {
        return proposedAt;
    }

    public void setProposedAt(Instant proposedAt) {
        this.proposedAt = proposedAt;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(Instant acceptedAt) {
        this.acceptedAt = acceptedAt;
    }

    public Instant getActivatedAt() {
        return activatedAt;
    }

    public void setActivatedAt(Instant activatedAt) {
        this.activatedAt = activatedAt;
    }

    public Instant getSuspendedAt() {
        return suspendedAt;
    }

    public void setSuspendedAt(Instant suspendedAt) {
        this.suspendedAt = suspendedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(Instant endedAt) {
        this.endedAt = endedAt;
    }
}
