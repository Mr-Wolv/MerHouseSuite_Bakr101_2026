import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders status labels in readable text', () => {
    render(<StatusBadge value="PARTIALLY_ALLOCATED" />)

    expect(screen.getByText('PARTIALLY ALLOCATED')).toBeInTheDocument()
  })

  it('adds plain-language explanations for domain-heavy statuses', () => {
    render(
      <div>
        <StatusBadge value="REQUESTED" />
        <StatusBadge value="LOCAL_RECORDED" />
        <StatusBadge value="READY_FOR_PROVIDER" />
        <StatusBadge value="RECEIVING" />
      </div>,
    )

    expect(screen.getByLabelText(/REQUESTED: Requested and waiting/i).getAttribute('title')).toContain('waiting')
    expect(screen.getByLabelText(/LOCAL RECORDED: Recorded inside MerHouse/i).getAttribute('title')).toContain('local review')
    expect(screen.getByLabelText(/READY FOR PROVIDER: Ready for an external delivery provider/i).getAttribute('title')).toContain('external')
    expect(screen.getByLabelText(/RECEIVING: Warehouse is actively receiving/i).getAttribute('title')).toContain('receiving')
  })
})
