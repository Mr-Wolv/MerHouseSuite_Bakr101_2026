import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { AssistantPage } from './AssistantPage'

const apiMock = vi.hoisted(() => ({
  assistantInteractions: vi.fn(),
  createAssistantInteraction: vi.fn(),
  acceptAssistantSuggestion: vi.fn(),
  rejectAssistantSuggestion: vi.fn(),
}))

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number
    details: string[]

    constructor(status: number, message: string, details: string[] = []) {
      super(message)
      this.status = status
      this.details = details
    }
  },
  api: apiMock,
}))

const authState: AuthState = {
  token: 'assistant-token',
  loading: false,
  user: {
    id: 'user-id',
    tenantId: 'tenant-id',
    email: 'merchant@example.test',
    role: 'MERCHANT',
    enabled: true,
    createdAt: '2026-05-30T00:00:00Z',
  },
  login: vi.fn(),
  logout: vi.fn(),
}

function renderPage(state = authState) {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={state}>
        <AssistantPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('AssistantPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.assistantInteractions.mockResolvedValue([
      {
        id: 'interaction-1',
        actorUserId: 'user-id',
        actorTenantId: 'tenant-id',
        scope: 'MERCHANT_OPERATIONS',
        targetTenantId: null,
        responseType: 'SUMMARY',
        actionStatus: 'NOT_APPLICABLE',
        requestText: 'Summarize my queues',
        responseText: 'Merchant operations summary: 7 orders or workload items.',
        prototypeLocal: true,
        decidedByUserId: null,
        decisionNote: null,
        decidedAt: null,
        metadata: {},
        createdAt: '2026-05-30T00:00:00Z',
      },
    ])
    apiMock.createAssistantInteraction.mockResolvedValue({
      id: 'interaction-2',
      actorUserId: 'user-id',
      actorTenantId: 'tenant-id',
      scope: 'MERCHANT_OPERATIONS',
      targetTenantId: null,
      responseType: 'SUGGESTION',
      actionStatus: 'PENDING',
      requestText: 'Suggest what needs review',
      responseText: 'Suggested next step: review open exceptions first because unresolved exception work can block operators from moving the queue safely.',
      prototypeLocal: true,
      decidedByUserId: null,
      decisionNote: null,
      decidedAt: null,
      metadata: {},
      createdAt: '2026-05-30T00:01:00Z',
    })
    apiMock.acceptAssistantSuggestion.mockResolvedValue({
      id: 'interaction-2',
      actorUserId: 'user-id',
      actorTenantId: 'tenant-id',
      scope: 'MERCHANT_OPERATIONS',
      targetTenantId: null,
      responseType: 'SUGGESTION',
      actionStatus: 'ACCEPTED',
      requestText: 'Suggest what needs review',
      responseText: 'Suggested next step: review open exceptions first because unresolved exception work can block operators from moving the queue safely.',
      prototypeLocal: true,
      decidedByUserId: 'user-id',
      decisionNote: 'Reviewed by operator',
      decidedAt: '2026-05-30T00:02:00Z',
      metadata: {},
      createdAt: '2026-05-30T00:01:00Z',
    })
    apiMock.rejectAssistantSuggestion.mockResolvedValue({
      id: 'interaction-2',
      actorUserId: 'user-id',
      actorTenantId: 'tenant-id',
      scope: 'MERCHANT_OPERATIONS',
      targetTenantId: null,
      responseType: 'SUGGESTION',
      actionStatus: 'REJECTED',
      requestText: 'Suggest what needs review',
      responseText: 'Suggested next step: review open exceptions first because unresolved exception work can block operators from moving the queue safely.',
      prototypeLocal: true,
      decidedByUserId: 'user-id',
      decisionNote: 'Reviewed by operator',
      decidedAt: '2026-05-30T00:02:00Z',
      metadata: {},
      createdAt: '2026-05-30T00:01:00Z',
    })
  })

  it('loads assistant history with review-ready language', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeInTheDocument()
    expect(screen.getByLabelText('Assistant review boundary')).toHaveTextContent('operational records are not mutated')
    expect(screen.getByText('Summarize my queues')).toBeInTheDocument()
    expect(screen.getByText('Merchant operations summary: 7 orders or workload items.')).toBeInTheDocument()
    expect(screen.getAllByText('Review record')).toHaveLength(1)
    expect(screen.queryByText(/prototype/i)).not.toBeInTheDocument()
    expect(screen.getByText('Audit trail recorded')).toBeInTheDocument()
    expect(screen.getByText('No decision recorded yet')).toBeInTheDocument()
    expect(apiMock.assistantInteractions).toHaveBeenCalledWith('assistant-token', 25)
  })

  it('submits a scoped assistant prompt', async () => {
    const user = userEvent.setup()
    renderPage()

    const prompt = await screen.findByLabelText('Prompt')
    await user.clear(prompt)
    await user.type(prompt, 'Suggest what needs review')
    await user.click(screen.getByRole('button', { name: 'Run assistant' }))

    expect(apiMock.createAssistantInteraction).toHaveBeenCalledWith('assistant-token', {
      scope: 'MERCHANT_OPERATIONS',
      targetTenantId: null,
      prompt: 'Suggest what needs review',
    })
    expect(await screen.findByText('Suggested next step: review open exceptions first because unresolved exception work can block operators from moving the queue safely.')).toBeInTheDocument()
    expect(screen.getByText('Pending suggestions').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Suggested next step: review open exceptions first because unresolved exception work can block operators from moving the queue safely.').closest('article')).toHaveClass('risk-card')
  })

  it('accepts a pending assistant suggestion with an audit reason', async () => {
    const user = userEvent.setup()
    renderPage()

    const prompt = await screen.findByLabelText('Prompt')
    await user.clear(prompt)
    await user.type(prompt, 'Suggest what needs review')
    await user.click(screen.getByRole('button', { name: 'Run assistant' }))
    await user.click(await screen.findByRole('button', { name: 'Accept suggestion' }))

    expect(apiMock.acceptAssistantSuggestion).toHaveBeenCalledWith('assistant-token', 'interaction-2', {
      reason: 'Reviewed by operator',
    })
    expect(await screen.findByText('ACCEPTED')).toBeInTheDocument()
    expect(screen.getByText('Reviewed by operator')).toBeInTheDocument()
  })

  it('links platform roles to the assistant audit trail', async () => {
    renderPage({
      ...authState,
      user: {
        ...authState.user!,
        role: 'ADMIN',
      },
    })

    expect(await screen.findByRole('link', { name: 'Open assistant audit trail' })).toHaveAttribute('href', '/admin/audit')
  })

  it('limits merchant users to merchant operations scope', async () => {
    renderPage()

    const scope = await screen.findByLabelText('Scope')
    expect(scope).toHaveTextContent('Merchant operations')
    expect(scope).not.toHaveTextContent('Platform overview')
    expect(screen.queryByLabelText('Target tenant id')).not.toBeInTheDocument()
  })

  it('hides suggestion decision controls from auditors', async () => {
    apiMock.assistantInteractions.mockResolvedValue([
      {
        id: 'interaction-auditor',
        actorUserId: 'auditor-id',
        actorTenantId: 'platform-tenant',
        scope: 'PLATFORM_OVERVIEW',
        targetTenantId: null,
        responseType: 'SUGGESTION',
        actionStatus: 'PENDING',
        requestText: 'Suggest platform review',
        responseText: 'Suggested next step: review failed outbox events.',
        prototypeLocal: true,
        decidedByUserId: null,
        decisionNote: null,
        decidedAt: null,
        metadata: {},
        createdAt: '2026-05-30T00:00:00Z',
      },
    ])

    renderPage({
      ...authState,
      user: {
        ...authState.user!,
        id: 'auditor-id',
        role: 'AUDITOR',
      },
    })

    expect(await screen.findByText('Suggested next step: review failed outbox events.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Decision reason')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept suggestion' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject suggestion' })).not.toBeInTheDocument()
  })

  it('guides users when assistant history is empty', async () => {
    apiMock.assistantInteractions.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('No assistant reviews yet')).toBeInTheDocument()
    expect(screen.getByText(/Start with a scoped summary/i)).toBeInTheDocument()
  })
})
