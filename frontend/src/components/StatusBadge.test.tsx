import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders status labels in readable text', () => {
    render(<StatusBadge value="PARTIALLY_ALLOCATED" />)

    expect(screen.getByText('PARTIALLY ALLOCATED')).toBeInTheDocument()
  })
})
