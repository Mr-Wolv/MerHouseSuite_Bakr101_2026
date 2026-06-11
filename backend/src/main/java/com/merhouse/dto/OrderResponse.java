package com.merhouse.dto;

import com.merhouse.entity.CustomerOrder;
import com.merhouse.entity.OrderStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderResponse(
    UUID id,
    UUID merchantId,
    String customerAddress,
    OrderStatus status,
    List<OrderItemResponse> items,
    List<FulfillmentAllocationResponse> allocations,
    List<BackorderItemResponse> backorders,
    Instant createdAt
) {
    public static OrderResponse from(CustomerOrder order) {
        return new OrderResponse(
            order.getId(),
            order.getMerchant().getId(),
            order.getCustomerAddress(),
            order.getStatus(),
            order.getItems().stream().map(OrderItemResponse::from).toList(),
            order.getAllocations().stream().map(FulfillmentAllocationResponse::from).toList(),
            order.getBackorders().stream().map(BackorderItemResponse::from).toList(),
            order.getCreatedAt()
        );
    }
}
