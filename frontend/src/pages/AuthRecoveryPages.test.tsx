import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage, SignUpPage, ResetPasswordPage } from './AuthRecoveryPages'

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

const ApiErrorMock = vi.hoisted(() => {
  return class extends Error {
    status: number
    details: string[]
    constructor(status: number, message: string, details: string[] = []) {
      super(message)
      this.status = status
      this.details = details
    }
  }
})

const apiMock = vi.hoisted(() => ({
  requestPasswordReset: vi.fn().mockResolvedValue({ message: '', resetToken: null, resetPath: null }),
  confirmPasswordReset: vi.fn(),
  signUp: vi.fn(),
  resetWithRecoveryKey: vi.fn(),
}))

vi.mock('../api/client', () => ({
  ApiError: ApiErrorMock,
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
    expect(screen.getByText(/reset without email/i)).toBeInTheDocument()
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

  it('creates an account and shows the created email and recovery key', async () => {
    const user = userEvent.setup()
    apiMock.signUp.mockResolvedValue({
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'owner@acme.test',
        role: 'MERCHANT',
        enabled: true,
        createdAt: '2026-05-18T00:00:00Z',
      },
      recoveryKey: 'AB12-CD34-EF56-GH78',
    })

    render(<SignUpPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Organization'), ' Acme ')
    await user.type(screen.getByLabelText('Email'), ' owner@acme.test ')
    await user.type(screen.getByLabelText('Password'), ' password123 ')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(apiMock.signUp).toHaveBeenCalledWith({
      organizationName: 'Acme',
      email: 'owner@acme.test',
      password: ' password123 ',
      requestedRole: 'MERCHANT',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Account created for owner@acme.test.')
    expect(screen.getByTestId('recovery-key-value')).toHaveTextContent('AB12-CD34-EF56-GH78')
  })

  it('shows an error when sign-up fails', async () => {
    const user = userEvent.setup()
    apiMock.signUp.mockRejectedValue(new ApiErrorMock(409, 'Conflict', ['User already exists with email: owner@acme.test']))

    render(<SignUpPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Organization'), 'Acme')
    await user.type(screen.getByLabelText('Email'), 'owner@acme.test')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('User already exists with email: owner@acme.test')
  })

  it('resets password with recovery key and shows the new recovery key', async () => {
    const user = userEvent.setup()
    apiMock.resetWithRecoveryKey.mockResolvedValue({
      message: 'Password has been reset using recovery key.',
      recoveryKey: 'ZZ99-YY88-XX77-WW66',
    })

    render(<ForgotPasswordPage />, { wrapper: MemoryRouter })

    // Switch to recovery key tab
    await user.click(screen.getByRole('button', { name: 'Recovery key' }))

    await user.type(screen.getByLabelText('Email'), 'user@merhouse.local')
    await user.type(screen.getByLabelText('Recovery key'), 'AB12-CD34-EF56-GH78')
    await user.type(screen.getByLabelText('New password'), 'new-password-123')
    await user.click(screen.getByRole('button', { name: 'Reset with recovery key' }))

    expect(apiMock.resetWithRecoveryKey).toHaveBeenCalledWith('user@merhouse.local', 'AB12-CD34-EF56-GH78', 'new-password-123')
    expect(await screen.findByRole('status')).toHaveTextContent(/password has been reset using recovery key/i)
    expect(screen.getByTestId('recovery-key-value')).toHaveTextContent('ZZ99-YY88-XX77-WW66')
  })

  it('shows error when recovery key reset fails', async () => {
    const user = userEvent.setup()
    apiMock.resetWithRecoveryKey.mockRejectedValue(new ApiErrorMock(409, 'Conflict', ['Invalid recovery key or email.']))

    render(<ForgotPasswordPage />, { wrapper: MemoryRouter })

    await user.click(screen.getByRole('button', { name: 'Recovery key' }))

    await user.type(screen.getByLabelText('Email'), 'user@merhouse.local')
    await user.type(screen.getByLabelText('Recovery key'), 'XX99-YY88-ZZ77-WW66')
    await user.type(screen.getByLabelText('New password'), 'new-password-123')
    await user.click(screen.getByRole('button', { name: 'Reset with recovery key' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid recovery key or email.')
  })
})

describe('login secondary actions', () => {
  it('keeps sign-up panel visible from the public panel', () => {
    render(<SignUpPage />, { wrapper: MemoryRouter })

    const panel = screen.getByRole('main')
    expect(within(panel).getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
    expect(within(panel).getByLabelText('Public account workflow guardrails')).toHaveTextContent('Direct registration')
    expect(within(panel).getByRole('link', { name: 'Already have an account? Sign in' })).toHaveAttribute('href', '/login')
  })
})
