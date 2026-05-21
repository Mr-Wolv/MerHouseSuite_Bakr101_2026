package com.merhouse.repository;

import com.merhouse.entity.CarrierDispatch;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CarrierDispatchRepository extends JpaRepository<CarrierDispatch, UUID> {
    boolean existsByOutboxEventId(UUID outboxEventId);

    List<CarrierDispatch> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<CarrierDispatch> findByShipmentIdOrderByCreatedAtDesc(UUID shipmentId);
}
