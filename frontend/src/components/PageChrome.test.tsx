import { render, screen } from '@testing-library/react'
import {
  FirstRunChecklist,
  GuidancePanel,
  PageHeading,
  QuantityCell,
  WorkflowDivider,
} from './PageChrome'

describe('PageHeading', () => {
  it('renders title as h1 and subtitle as paragraph', () => {
    render(<PageHeading title="Admin Overview" subtitle="Platform governance at a glance" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Admin Overview' })).toBeInTheDocument()
    expect(screen.getByText('Platform governance at a glance')).toBeInTheDocument()
  })

  it('wraps content in a page-heading class', () => {
    const { container } = render(<PageHeading title="Test" subtitle="Sub" />)
    expect(container.querySelector('.page-heading')).toBeInTheDocument()
  })

  it('handles empty strings without crashing', () => {
    render(<PageHeading title="" subtitle="" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('')
  })
})

describe('GuidancePanel', () => {
  it('renders title and children in an accessible aside region', () => {
    render(<GuidancePanel title="Owner guidance">Owners can manage tenants and users.</GuidancePanel>)

    const region = screen.getByRole('complementary', { name: 'Owner guidance' })
    expect(region).toBeInTheDocument()
    expect(region).toHaveTextContent('Owners can manage tenants and users.')
    expect(screen.getByText('Owner guidance')).toBeInTheDocument()
  })
})

describe('WorkflowDivider', () => {
  it('renders eyebrow, title, and description', () => {
    render(
      <WorkflowDivider
        eyebrow="Step 1"
        title="Create a tenant"
        description="Tenants represent organizations in the platform."
      />,
    )

    expect(screen.getByText('Step 1')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Create a tenant' })).toBeInTheDocument()
    expect(screen.getByText('Tenants represent organizations in the platform.')).toBeInTheDocument()
  })

  it('uses the workflow-divider class', () => {
    const { container } = render(
      <WorkflowDivider eyebrow="E" title="T" description="D" />,
    )
    expect(container.querySelector('.workflow-divider')).toBeInTheDocument()
  })
})

describe('FirstRunChecklist', () => {
  it('renders all items with correct done/pending status', () => {
    render(
      <FirstRunChecklist
        title="Setup checklist"
        items={[
          { label: 'Create tenant', done: true, detail: 'A tenant has been created.' },
          { label: 'Add users', done: false, detail: 'Create at least one user.' },
          { label: 'Configure warehouse', done: true, detail: 'Warehouse is linked.' },
        ]}
      />,
    )

    const section = screen.getByRole('region', { name: 'Setup checklist' })
    expect(section).toBeInTheDocument()

    // Count display
    expect(screen.getByText('2/3 ready')).toBeInTheDocument()

    // Completed items show "Ready"
    const readyChips = screen.getAllByText('Ready')
    expect(readyChips).toHaveLength(2)

    // Pending items show "Next"
    expect(screen.getByText('Next')).toBeInTheDocument()

    // Item labels and details
    expect(screen.getByText('Create tenant')).toBeInTheDocument()
    expect(screen.getByText('Add users')).toBeInTheDocument()
    expect(screen.getByText('Configure warehouse')).toBeInTheDocument()
  })

  it('shows 0/N ready when no items are done', () => {
    render(
      <FirstRunChecklist
        title="Empty checklist"
        items={[
          { label: 'Step A', done: false, detail: 'Do A' },
          { label: 'Step B', done: false, detail: 'Do B' },
        ]}
      />,
    )

    expect(screen.getByText('0/2 ready')).toBeInTheDocument()
    expect(screen.queryByText('Ready')).not.toBeInTheDocument()
  })

  it('shows N/N ready when all items are done', () => {
    render(
      <FirstRunChecklist
        title="Complete"
        items={[
          { label: 'Done 1', done: true, detail: 'D1' },
          { label: 'Done 2', done: true, detail: 'D2' },
        ]}
      />,
    )

    expect(screen.getByText('2/2 ready')).toBeInTheDocument()
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('handles an empty items array', () => {
    render(<FirstRunChecklist title="Nothing" items={[]} />)
    expect(screen.getByText('0/0 ready')).toBeInTheDocument()
  })
})

describe('QuantityCell', () => {
  it('renders the value with default neutral tone', () => {
    const { container } = render(<QuantityCell value={42} />)
    const cell = container.querySelector('.quantity-cell')
    expect(cell).toHaveTextContent('42')
    expect(cell).toHaveClass('quantity-neutral')
  })

  it.each([
    ['ready', 'quantity-ready'],
    ['pending', 'quantity-pending'],
    ['risk', 'quantity-risk'],
    ['neutral', 'quantity-neutral'],
  ] as const)('applies %s tone class', (tone, expectedClass) => {
    const { container } = render(<QuantityCell value={10} tone={tone} />)
    expect(container.querySelector('.quantity-cell')).toHaveClass(expectedClass)
  })

  it('renders zero values correctly', () => {
    const { container } = render(<QuantityCell value={0} />)
    expect(container.querySelector('.quantity-cell')).toHaveTextContent('0')
  })

  it('renders negative values', () => {
    const { container } = render(<QuantityCell value={-5} tone="risk" />)
    expect(container.querySelector('.quantity-cell')).toHaveTextContent('-5')
    expect(container.querySelector('.quantity-cell')).toHaveClass('quantity-risk')
  })
})
