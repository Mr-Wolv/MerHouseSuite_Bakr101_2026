package com.merhouse.repository;

import com.merhouse.entity.CustomerContact;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerContactRepository extends JpaRepository<CustomerContact, UUID> {
    @EntityGraph(attributePaths = "merchant")
    List<CustomerContact> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);
}
