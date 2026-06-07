import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AttentionQueue } from './AttentionQueue'
import type { AttentionSignal } from '../api/types'

const activeSignal: AttentionSignal = {
  id: 'signal-1',
  severity: 'CRITICAL',
  title: 'Outbox failures need reliability review',
  body: 'Failed integration work is waiting for retry.',
  ownerRole: 'ADMIN',
  nextActionLabel: 'Open outbox diagnostics',
  route: '/admin/outbox',
  sourceType: 'OutboxEvent',
  sourceId: '11111111-1111-1111-1111-111111111111',
  createdAt: '2026-06-07T08:00:00Z',
  resolved: false,
}

const resolvedSignal: AttentionSignal = {
  ...activeSignal,
  id: 'signal-2',
  severity: 'CLEARED',
  resolved: true,
}

describe('AttentionQueue', () => {
  it('renders active signal severity, owner, source, icon, and next action', () => {
    render(<AttentionQueue signals={[activeSignal, resolvedSignal]} />)

    expect(screen.getByRole('heading', { name: 'Needs Attention First' })).toBeInTheDocument()
    expect(screen.getByText('1 active')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('Owner: ADMIN')).toBeInTheDocument()
    expect(screen.getByText(/OutboxEvent 11111111/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open outbox diagnostics' })).toHaveAttribute('href', '/admin/outbox')
    expect(document.querySelector('.attention-icon svg')).toHaveClass('lucide-siren')
    expect(screen.getByLabelText('Resolved attention history')).toHaveTextContent('1')
  })

  it('renders an accessible empty state when no active signals exist', () => {
    render(<AttentionQueue signals={[]} emptyLabel="No blocked work" />)

    expect(screen.getByLabelText('Needs Attention First')).toHaveTextContent('No blocked work')
    expect(screen.getByText('0 active')).toBeInTheDocument()
  })
})
