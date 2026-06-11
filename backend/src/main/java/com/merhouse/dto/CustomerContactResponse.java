package com.merhouse.dto;

import com.merhouse.entity.CustomerContact;
import java.time.Instant;
import java.util.UUID;

public record CustomerContactResponse(
    UUID id,
    UUID merchantId,
    String label,
    String contactName,
    String phone,
    String address,
    Instant createdAt
) {
    public static CustomerContactResponse from(CustomerContact contact) {
        return new CustomerContactResponse(
            contact.getId(),
            contact.getMerchant().getId(),
            contact.getLabel(),
            contact.getContactName(),
            contact.getPhone(),
            contact.getAddress(),
            contact.getCreatedAt()
        );
    }
}
