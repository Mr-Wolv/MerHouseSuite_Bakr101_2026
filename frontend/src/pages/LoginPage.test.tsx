import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'

const authMock = vi.hoisted(() => ({
  login: vi.fn(),
  user: null as unknown,
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => authMock,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    authMock.login.mockReset()
    authMock.user = null
  })

  it('does not prefill local development credentials', () => {
    render(<LoginPage />, { wrapper: MemoryRouter })

    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
    expect(screen.getByLabelText('Public account workflow guardrails')).toHaveTextContent('Access boundary')
    expect(screen.getByText(/reviewable delivery history/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('trims copied email whitespace without changing the password', async () => {
    const user = userEvent.setup()
    authMock.login.mockResolvedValue(undefined)

    render(<LoginPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Email'), ' merchant@example.test ')
    await user.type(screen.getByLabelText('Password'), ' typed-password ')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(authMock.login).toHaveBeenCalledWith('merchant@example.test', ' typed-password ')
  })
})
