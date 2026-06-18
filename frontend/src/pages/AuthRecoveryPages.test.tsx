import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage, RequestAccessPage, ResetPasswordPage } from './AuthRecoveryPages'

const apiMock = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  submitAccessRequest: vi.fn(),
}))

const firebaseAuthMock = vi.hoisted(() => ({
  sendFirebasePasswordReset: vi.fn(),
  verifyResetCode: vi.fn(),
  confirmFirebasePasswordReset: vi.fn(),
  friendlyAuthError: vi.fn((caught: unknown) => {
    const code = (caught as { code?: string })?.code
    if (code === 'auth/invalid-oob-code') return 'This reset link is invalid or has expired.'
    if (code === 'auth/user-not-found') return 'Invalid email or password.'
    return (caught as { message?: string })?.message ?? 'An unexpected error occurred.'
  }),
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

vi.mock('../lib/firebase-auth', () => firebaseAuthMock)

describe('auth recovery pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a Firebase password reset link without exposing email existence', async () => {
    const user = userEvent.setup()
    firebaseAuthMock.sendFirebasePasswordReset.mockResolvedValue(undefined)

    render(<ForgotPasswordPage />, { wrapper: MemoryRouter })

    expect(screen.getByText('Request a reset for an enabled MerHouse account.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), ' owner@example.test ')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(firebaseAuthMock.sendFirebasePasswordReset).toHaveBeenCalledWith('owner@example.test')
    expect(await screen.findByRole('status')).toHaveTextContent(
      /if an enabled account exists for that email, a password reset link has been sent/i,
    )
    expect(screen.getByText(/does not reveal whether an email exists/i)).toBeInTheDocument()
  })

  it('shows a friendly error when Firebase reset fails', async () => {
    const user = userEvent.setup()
    const firebaseError = Object.assign(new Error('not found'), { code: 'auth/user-not-found' })
    firebaseAuthMock.sendFirebasePasswordReset.mockRejectedValue(firebaseError)

    render(<ForgotPasswordPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Email'), 'unknown@example.test')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
  })

  it('verifies oobCode on mount and resets password with Firebase', async () => {
    const user = userEvent.setup()
    firebaseAuthMock.verifyResetCode.mockResolvedValue('user@example.test')
    firebaseAuthMock.confirmFirebasePasswordReset.mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/reset-password?oobCode=valid-oob-code']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Wait for verification to complete
    expect(await screen.findByLabelText('Email')).toHaveValue('user@example.test')

    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(firebaseAuthMock.confirmFirebasePasswordReset).toHaveBeenCalledWith('valid-oob-code', 'new-password')
    expect(await screen.findByRole('status')).toHaveTextContent(/password has been reset/i)
  })

  it('shows error when oobCode is invalid or expired', async () => {
    const firebaseError = Object.assign(new Error('invalid'), { code: 'auth/invalid-oob-code' })
    firebaseAuthMock.verifyResetCode.mockRejectedValue(firebaseError)

    render(
      <MemoryRouter initialEntries={['/reset-password?oobCode=bad-code']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.')
  })

  it('shows error when no oobCode is present', async () => {
    render(<ResetPasswordPage />, { wrapper: MemoryRouter })

    expect(await screen.findByRole('alert')).toHaveTextContent('No reset code provided.')
  })

  it('shows error when Firebase password confirmation fails', async () => {
    const user = userEvent.setup()
    firebaseAuthMock.verifyResetCode.mockResolvedValue('user@example.test')
    const firebaseError = Object.assign(new Error('expired'), { code: 'auth/invalid-oob-code' })
    firebaseAuthMock.confirmFirebasePasswordReset.mockRejectedValue(firebaseError)

    render(
      <MemoryRouter initialEntries={['/reset-password?oobCode=expired-code']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByLabelText('Email')).toHaveValue('user@example.test')

    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.')
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
