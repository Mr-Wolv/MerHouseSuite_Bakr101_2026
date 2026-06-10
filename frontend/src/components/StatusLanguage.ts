const statusExplanations: Record<string, string> = {
  ACCEPTED: 'Accepted for review or follow-up.',
  ACTIVE: 'Currently usable for daily work.',
  APPROVED: 'Approved and ready for the next step.',
  ARCHIVED: 'Hidden from new daily work but kept for history.',
  CANCELLED: 'Stopped before the workflow finished.',
  CLEARED: 'Reviewed or no longer needs attention.',
  CONVERTED: 'Turned into the related account or operational record.',
  CREATED: 'Created and waiting for the next workflow step.',
  DEAD_LETTER: 'Moved out of retry processing for manual review.',
  DELIVERED: 'Shipment reached the delivered state.',
  DISABLED: 'Unavailable until enabled again.',
  DISPUTED: 'Under dispute and needs review before closure.',
  DRAFT: 'Saved but not submitted for partner work yet.',
  ENABLED: 'Available for use.',
  ENDED: 'Relationship or workflow has been closed.',
  FAILED: 'Workflow failed and needs investigation or retry.',
  FINALIZED: 'Locked as the final version for review or settlement.',
  IN_TRANSIT: 'Shipment has left the warehouse and is moving.',
  LOCAL_RECORDED: 'Recorded inside MerHouse for local review history.',
  MARKED_SETTLED: 'Marked as settled after statement review.',
  NOT_APPLICABLE: 'No action is required for this item.',
  NOT_CONFIGURED: 'No external provider is configured; MerHouse records the event locally.',
  OPEN: 'Still active and needs review or closure.',
  PACKED: 'Items are packed and ready for shipment evidence.',
  PENDING: 'Waiting for the next human or workflow decision.',
  PICKING: 'Warehouse work has started picking the allocation.',
  PREPARED: 'Prepared for delivery or handoff, but not completed yet.',
  PROCESSED: 'Processed successfully.',
  PROVIDER_FAILED: 'External provider delivery failed and needs review.',
  PROVIDER_SENT: 'External provider accepted the delivery.',
  READY_FOR_PROVIDER: 'Ready for an external delivery provider when one is configured.',
  RECEIVED: 'Inbound stock has been received.',
  RECEIVING: 'Warehouse is actively receiving inbound stock.',
  RECORDED: 'Saved in MerHouse and still unread or unhandled.',
  REJECTED: 'Rejected and closed from the happy path.',
  REQUESTED: 'Requested and waiting for the other side to activate or approve.',
  RESET_LOCKED: 'Password reset action is blocked until a valid temporary password is ready.',
  RESET_READY: 'Password reset action has the required temporary password.',
  RESOLVED: 'Issue has been closed after review.',
  RETURNED: 'Shipment was returned instead of delivered.',
  SHIPPED: 'Shipment has been handed off and is awaiting final result.',
  SKIPPED_BY_PREFERENCE: 'Skipped because this user disabled that notification channel.',
  SUBMITTED: 'Submitted and waiting for partner processing.',
  SUSPENDED: 'Temporarily blocked from daily work.',
}

export function statusLabel(value: string) {
  return value.replaceAll('_', ' ')
}

export function statusExplanation(value: string) {
  return statusExplanations[value.toUpperCase()]
}

export function statusAccessibleLabel(value: string) {
  const label = statusLabel(value)
  const explanation = statusExplanation(value)
  return explanation ? `${label}: ${explanation}` : label
}
