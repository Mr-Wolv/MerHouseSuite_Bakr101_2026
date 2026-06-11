package com.merhouse.service;

import com.merhouse.entity.AdminAuditEvent;
import com.merhouse.entity.AppUser;
import com.merhouse.repository.AdminAuditEventRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuditService {
    private final AdminAuditEventRepository auditRepository;
    private final UserService userService;

    public AdminAuditService(AdminAuditEventRepository auditRepository, UserService userService) {
        this.auditRepository = auditRepository;
        this.userService = userService;
    }

    @Transactional
    public void record(UUID actorUserId, String action, String aggregateType, UUID aggregateId, String reason) {
        record(actorUserId, action, aggregateType, aggregateId, reason, Map.of());
    }

    @Transactional
    public void record(
        UUID actorUserId,
        String action,
        String aggregateType,
        UUID aggregateId,
        String reason,
        Map<String, Object> metadata
    ) {
        AdminAuditEvent event = new AdminAuditEvent();
        if (actorUserId != null) {
            AppUser actor = userService.getRequired(actorUserId);
            event.setActor(actor);
        }
        event.setAction(action);
        event.setAggregateType(aggregateType);
        event.setAggregateId(aggregateId);
        event.setReason(trimToNull(reason));
        event.setMetadata(metadata == null ? Map.of() : metadata);
        auditRepository.save(event);
    }

    @Transactional(readOnly = true)
    public List<AdminAuditEvent> recentEvents(int limit) {
        int bounded = Math.max(1, Math.min(limit, 100));
        return auditRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, bounded));
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
