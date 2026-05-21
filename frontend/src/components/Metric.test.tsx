import { render, screen } from '@testing-library/react'
import { Metric } from './Metric'

describe('Metric', () => {
  it('renders the metric label and value', () => {
    render(<Metric label="Orders" value={42} />)

    expect(screen.getByText('Orders')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })
})
