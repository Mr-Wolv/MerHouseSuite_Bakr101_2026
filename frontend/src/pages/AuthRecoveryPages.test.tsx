import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApiError } from '../api/client'
import { ForgotPasswordPage, RequestAccessPage, ResetPasswordPage, VerifyOtpPage } from './AuthRecoveryPages'

const apiMock = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  requestOtp: vi.fn(),
  confirmPasswordReset: vi.fn(),
  resetWithOtp: vi.fn(),
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
    apiMock.requestOtp.mockResolvedValue({
      message: 'If an enabled account exists for that email, a one-time password has been sent.',
      resetToken: null,
      resetPath: null,
    })

    render(<ForgotPasswordPage />, { wrapper: MemoryRouter })

    expect(screen.getByText('Request a reset for an enabled MerHouse account.')).toBeInTheDocument()
    expect(screen.queryByText(/local MerHouse account/i)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), ' owner@example.test ')
    await user.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(apiMock.requestOtp).toHaveBeenCalledWith('owner@example.test')
    expect(screen.getByText(/does not reveal whether an email exists/i)).toBeInTheDocument()
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

  it('trims copied reset-token whitespace without changing the new password', async () => {
    const user = userEvent.setup()
    apiMock.confirmPasswordReset.mockResolvedValue({ message: 'Password has been reset.' })

    render(<ResetPasswordPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Reset token'), '  copied-token  ')
    await user.type(screen.getByLabelText('New password'), ' new-password ')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(apiMock.confirmPasswordReset).toHaveBeenCalledWith('copied-token', ' new-password ')
  })

  it('trims copied public access request fields before submitting', async () => {
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

    await user.type(screen.getByLabelText('Organization'), ' Acme ')
    await user.type(screen.getByLabelText('Email'), ' owner@acme.test ')
    await user.type(screen.getByLabelText('Notes'), ' Please onboard ')
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
    apiMock.requestOtp.mockRejectedValue(new ApiError(400, 'Validation failed', ['email must be valid']))

    render(<ForgotPasswordPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Email'), 'blocked@example.test')
    await user.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('email must be valid')
  })

  it('verifies OTP and resets password', async () => {
    const user = userEvent.setup()
    apiMock.resetWithOtp.mockResolvedValue({ message: 'Password has been reset.' })

    render(
      <MemoryRouter initialEntries={['/verify-otp?email=user@example.test']}>
        <Routes>
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Email')).toHaveValue('user@example.test')
    await user.type(screen.getByLabelText('One-time password'), '123456')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(apiMock.resetWithOtp).toHaveBeenCalledWith('user@example.test', '123456', 'new-password')
    expect(await screen.findByRole('status')).toHaveTextContent(/password has been reset/i)
  })

  it('shows error when OTP is invalid or expired', async () => {
    const user = userEvent.setup()
    apiMock.resetWithOtp.mockRejectedValue(new ApiError(409, 'Conflict', ['OTP code is invalid or expired.']))

    render(
      <MemoryRouter initialEntries={['/verify-otp?email=user@example.test']}>
        <Routes>
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('One-time password'), '000000')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('OTP code is invalid or expired.')
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
