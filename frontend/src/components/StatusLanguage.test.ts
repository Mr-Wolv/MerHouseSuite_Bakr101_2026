import { statusAccessibleLabel, statusExplanation, statusLabel } from './StatusLanguage'

describe('statusLabel', () => {
  it('replaces underscores with spaces', () => {
    expect(statusLabel('IN_TRANSIT')).toBe('IN TRANSIT')
    expect(statusLabel('DEAD_LETTER')).toBe('DEAD LETTER')
    expect(statusLabel('SKIPPED_BY_PREFERENCE')).toBe('SKIPPED BY PREFERENCE')
  })

  it('returns single-word statuses unchanged', () => {
    expect(statusLabel('ACTIVE')).toBe('ACTIVE')
    expect(statusLabel('PENDING')).toBe('PENDING')
    expect(statusLabel('FAILED')).toBe('FAILED')
  })

  it('handles empty string', () => {
    expect(statusLabel('')).toBe('')
  })

  it('handles already-space-separated values', () => {
    expect(statusLabel('ALREADY SPACED')).toBe('ALREADY SPACED')
  })

  it('handles multiple consecutive underscores', () => {
    expect(statusLabel('A__B')).toBe('A  B')
  })
})

describe('statusExplanation', () => {
  const knownStatuses = [
    'ACCEPTED', 'ACTIVE', 'APPROVED', 'ARCHIVED', 'CANCELLED', 'CLEARED',
    'CONVERTED', 'CREATED', 'DEAD_LETTER', 'DELIVERED', 'DISABLED', 'DISPUTED',
    'DRAFT', 'ENABLED', 'ENDED', 'FAILED', 'FINALIZED', 'IN_TRANSIT',
    'LOCAL_RECORDED', 'MARKED_SETTLED', 'NOT_APPLICABLE', 'NOT_CONFIGURED',
    'OPEN', 'PACKED', 'PENDING', 'PICKING', 'PREPARED', 'PROCESSED',
    'PROVIDER_FAILED', 'PROVIDER_RECORDED', 'PROVIDER_SENT',
    'READY_FOR_PROVIDER', 'RECEIVED', 'RECEIVING', 'RECORDED', 'REJECTED',
    'REQUESTED', 'RESET_LOCKED', 'RESET_READY', 'RESOLVED', 'RETURNED',
    'SHIPPED', 'SKIPPED_BY_PREFERENCE', 'SUBMITTED', 'SUSPENDED',
  ]

  it.each(knownStatuses)('has an explanation for %s', (status) => {
    const explanation = statusExplanation(status)
    expect(explanation).toBeTruthy()
    expect(typeof explanation).toBe('string')
    expect(explanation!.length).toBeGreaterThan(0)
  })

  it('returns undefined for unknown statuses', () => {
    expect(statusExplanation('UNKNOWN_STATUS')).toBeUndefined()
    expect(statusExplanation('FOOBAR')).toBeUndefined()
  })

  it('is case-insensitive', () => {
    expect(statusExplanation('active')).toBe(statusExplanation('ACTIVE'))
    expect(statusExplanation('Pending')).toBe(statusExplanation('PENDING'))
  })

  it('returns correct explanations for key statuses', () => {
    expect(statusExplanation('PENDING')).toBe('Waiting for the next human or workflow decision.')
    expect(statusExplanation('FAILED')).toBe('Workflow failed and needs investigation or retry.')
    expect(statusExplanation('ACTIVE')).toBe('Currently usable for daily work.')
    expect(statusExplanation('DELIVERED')).toBe('Shipment reached the delivered state.')
  })
})

describe('statusAccessibleLabel', () => {
  it('combines label and explanation for known statuses', () => {
    const label = statusAccessibleLabel('PENDING')
    expect(label).toBe('PENDING: Waiting for the next human or workflow decision.')
  })

  it('returns only the label for unknown statuses', () => {
    expect(statusAccessibleLabel('UNKNOWN')).toBe('UNKNOWN')
  })

  it('replaces underscores in the label portion', () => {
    const label = statusAccessibleLabel('DEAD_LETTER')
    expect(label).toMatch(/^DEAD LETTER: /)
    expect(label).toContain('Moved out of retry processing')
  })

  it('handles empty string gracefully', () => {
    expect(statusAccessibleLabel('')).toBe('')
  })

  it('produces distinct labels for different statuses', () => {
    const labels = new Set([
      statusAccessibleLabel('PENDING'),
      statusAccessibleLabel('ACTIVE'),
      statusAccessibleLabel('FAILED'),
      statusAccessibleLabel('DELIVERED'),
    ])
    expect(labels.size).toBe(4)
  })
})
