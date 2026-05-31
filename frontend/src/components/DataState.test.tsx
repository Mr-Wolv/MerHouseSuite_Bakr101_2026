import { render, screen } from '@testing-library/react'
import { EmptyState, ErrorState, LoadingState } from './DataState'

describe('DataState', () => {
  it('renders loading state as an announced status', () => {
    render(<LoadingState label="Loading warehouse work" />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading warehouse work')
  })

  it('selects workflow-specific empty-state icons while keeping guidance visible', () => {
    const { container, rerender } = render(
      <EmptyState
        label="No inventory items yet"
        guidance="Create your first SKU, then connect it to inbound stock."
      />,
    )

    expect(screen.getByText('No inventory items yet')).toBeInTheDocument()
    expect(screen.getByText(/Create your first SKU/i)).toBeInTheDocument()
    expect(container.querySelector('.empty-state-icon svg')).toHaveClass('lucide-boxes')

    rerender(<EmptyState label="Order detail is unavailable" guidance="Open a current order link." />)

    expect(container.querySelector('.empty-state-icon svg')).toHaveClass('lucide-search-x')
  })

  it('renders errors with an alert icon and details', () => {
    const { container } = render(<ErrorState title="Unable to load route" details={['Try again.']} />)

    expect(screen.getByText('Unable to load route')).toBeInTheDocument()
    expect(screen.getByText('Try again.')).toBeInTheDocument()
    expect(container.querySelector('.state-error-icon svg')).toHaveClass('lucide-triangle-alert')
  })

  it('can render top-level errors as page headings', () => {
    render(<ErrorState title="Inventory item not found" pageTitle />)

    expect(screen.getByRole('heading', { level: 1, name: 'Inventory item not found' })).toBeInTheDocument()
  })
})
