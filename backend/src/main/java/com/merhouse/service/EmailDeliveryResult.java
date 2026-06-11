package com.merhouse.service;

public record EmailDeliveryResult(
    boolean sent,
    String providerMessageId,
    String error
) {
    public static EmailDeliveryResult sent(String providerMessageId) {
        return new EmailDeliveryResult(true, providerMessageId, null);
    }

    public static EmailDeliveryResult failed(String error) {
        return new EmailDeliveryResult(false, null, error);
    }
}
