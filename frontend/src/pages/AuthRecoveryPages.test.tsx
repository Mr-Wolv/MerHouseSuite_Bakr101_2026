import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApiError } from '../api/client'
import { ForgotPasswordPage, RequestAccessPage, ResetPasswordPage } from './AuthRecoveryPages'

const apiMock = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  submitAccessRequest: vi.fn(),
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

describe('auth recovery pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests a password reset without exposing a reset link by default', async () => {
    const user = userEvent.setup()
    apiMock.requestPasswordReset.mockResolvedValue({
      message: 'If an enabled account exists for that email, a password reset link has been prepared.',
      resetToken: null,
      resetPath: null,
    })

    render(<ForgotPasswordPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Email'), 'owner@example.test')
    await user.click(screen.getByRole('button', { name: 'Request reset' }))

    expect(apiMock.requestPasswordReset).toHaveBeenCalledWith('owner@example.test')
    expect(screen.getByText(/does not reveal whether an email exists/i)).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent(/reset link has been prepared/i)
    expect(screen.queryByRole('link', { name: 'Open reset link' })).not.toBeInTheDocument()
  })

  it('confirms a password reset with the route token', async () => {
    const user = userEvent.setup()
    apiMock.confirmPasswordReset.mockResolvedValue({ message: 'Password has been reset.' })

    render(
      <MemoryRouter initialEntries={['/reset-password?token=route-token']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Reset token')).toHaveValue('route-token')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(apiMock.confirmPasswordReset).toHaveBeenCalledWith('route-token', 'new-password')
    expect(screen.getByText(/single-use local credentials/i)).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent(/password has been reset/i)
  })

  it('submits a merchant access request', async () => {
    const user = userEvent.setup()
    apiMock.submitAccessRequest.mockResolvedValue({
      id: 'request-1',
      organizationName: 'Acme',
      requesterEmail: 'owner@acme.test',
      requestedRole: 'MERCHANT',
      notes: 'Please onboard',
      status: 'PENDING',
      reviewedByUserId: null,
      reviewNote: null,
      reviewedAt: null,
      createdAt: '2026-05-18T00:00:00Z',
    })

    render(<RequestAccessPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Organization'), 'Acme')
    await user.type(screen.getByLabelText('Email'), 'owner@acme.test')
    await user.type(screen.getByLabelText('Notes'), 'Please onboard')
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(apiMock.submitAccessRequest).toHaveBeenCalledWith({
      organizationName: 'Acme',
      requesterEmail: 'owner@acme.test',
      requestedRole: 'MERCHANT',
      notes: 'Please onboard',
    })
    expect(screen.getByText(/avoid secrets, keys, or production credentials/i)).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Access request pending for owner@acme.test.')
  })

  it('shows backend validation errors', async () => {
    const user = userEvent.setup()
    apiMock.requestPasswordReset.mockRejectedValue(new ApiError(400, 'Validation failed', ['email must be valid']))

    render(<ForgotPasswordPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Email'), 'blocked@example.test')
    await user.click(screen.getByRole('button', { name: 'Request reset' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('email must be valid')
  })
})

describe('login secondary actions', () => {
  it('keeps recovery links visible from the public panel', () => {
    render(<RequestAccessPage />, { wrapper: MemoryRouter })

    const panel = screen.getByRole('main')
    expect(within(panel).getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
    expect(within(panel).getByLabelText('Public account workflow guardrails')).toHaveTextContent('Account readiness')
    expect(within(panel).getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
  })
})
