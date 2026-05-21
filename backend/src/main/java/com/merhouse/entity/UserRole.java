package com.merhouse.entity;

public enum UserRole {
    OWNER,
    ADMIN,
    SUPPORT_ADMIN,
    AUDITOR,
    MERCHANT,
    WAREHOUSE_OPERATOR;

    public boolean isPlatformAdmin() {
        return this == OWNER || this == ADMIN || this == SUPPORT_ADMIN || this == AUDITOR;
    }

    public boolean canMutatePlatform() {
        return this == OWNER || this == ADMIN;
    }

    public boolean canManageAdmins() {
        return this == OWNER;
    }

    public boolean canSupportUsers() {
        return this == OWNER || this == ADMIN || this == SUPPORT_ADMIN;
    }
}
