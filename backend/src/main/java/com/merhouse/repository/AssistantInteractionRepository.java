package com.merhouse.repository;

import com.merhouse.entity.AssistantInteraction;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssistantInteractionRepository extends JpaRepository<AssistantInteraction, UUID> {
    @EntityGraph(attributePaths = {"actor", "actorTenant"})
    List<AssistantInteraction> findByActorIdOrderByCreatedAtDesc(UUID actorId, Pageable pageable);

    @EntityGraph(attributePaths = {"actor", "actorTenant", "decidedBy"})
    Optional<AssistantInteraction> findById(UUID id);
}
