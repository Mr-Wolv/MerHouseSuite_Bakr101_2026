package com.merhouse.service;

import com.merhouse.entity.CarrierDispatch;
import com.merhouse.entity.OutboxEvent;
import com.merhouse.repository.CarrierDispatchRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class CarrierOutboxEventHandler implements OutboxEventHandler {
    private final CarrierDispatchRepository carrierDispatchRepository;

    public CarrierOutboxEventHandler(CarrierDispatchRepository carrierDispatchRepository) {
        this.carrierDispatchRepository = carrierDispatchRepository;
    }

    @Override
    public boolean supports(OutboxEvent event) {
        return "ShipmentCreated".equals(event.getEventType()) || "ShipmentDelivered".equals(event.getEventType());
    }

    @Override
    public void handle(OutboxEvent event) {
        if (carrierDispatchRepository.existsByOutboxEventId(event.getId())) {
            return;
        }

        Map<String, Object> payload = event.getPayload();
        UUID shipmentId = UUID.fromString(String.valueOf(payload.get("shipmentId")));

        CarrierDispatch dispatch = new CarrierDispatch();
        dispatch.setOutboxEventId(event.getId());
        dispatch.setShipmentId(shipmentId);
        dispatch.setEventType(event.getEventType());
        dispatch.setCarrier(optionalPayloadValue(payload, "carrier"));
        dispatch.setTrackingNumber(optionalPayloadValue(payload, "trackingNumber"));
        dispatch.setExternalReference("local-carrier-" + event.getId());
        carrierDispatchRepository.save(dispatch);
    }

    private String optionalPayloadValue(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        return value == null ? null : String.valueOf(value);
    }
}
