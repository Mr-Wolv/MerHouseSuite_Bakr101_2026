import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '../api/client'
import { AccountPage } from './AccountPage'

const apiMock = vi.hoisted(() => ({
  changeOwnPassword: vi.fn(),
}))

const authMock = vi.hoisted(() => ({
  token: 'account-token',
  user: {
    id: 'user-id',
    tenantId: 'tenant-id',
    email: 'merchant@merhouse.local',
    role: 'MERCHANT',
    enabled: true,
    createdAt: '2026-06-07T10:00:00Z',
  },
}))

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return {
    ...actual,
    api: apiMock,
  }
})

vi.mock('../auth/useAuth', () => ({
  useAuth: () => authMock,
}))

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.changeOwnPassword.mockResolvedValue({ message: 'Password changed.' })
  })

  it('renders account context and workflow links', () => {
    render(<AccountPage />, { wrapper: MemoryRouter })

    expect(screen.getByRole('heading', { name: 'Your MerHouse account' })).toBeInTheDocument()
    expect(screen.getByText('merchant@merhouse.local')).toBeInTheDocument()
    expect(screen.getByText('tenant-id')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alerts' })).toHaveAttribute('href', '/notifications')
    expect(screen.getByRole('link', { name: 'Service review' })).toHaveAttribute('href', '/service-accountability')
  })

  it('blocks mismatched password confirmation before calling the API', async () => {
    const user = userEvent.setup()
    render(<AccountPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Current password'), 'current-password')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.type(screen.getByLabelText('Confirm new password'), 'different-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('New password and confirmation must match.')
    expect(apiMock.changeOwnPassword).not.toHaveBeenCalled()
  })

  it('changes password, announces success, and clears password fields', async () => {
    const user = userEvent.setup()
    render(<AccountPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Current password'), 'current-password')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.type(screen.getByLabelText('Confirm new password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(apiMock.changeOwnPassword).toHaveBeenCalledWith('account-token', {
      currentPassword: 'current-password',
      newPassword: 'new-password',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Password changed.')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('')
  })

  it('announces API errors without clearing the form', async () => {
    const user = userEvent.setup()
    apiMock.changeOwnPassword.mockRejectedValue(new ApiError(401, 'Unauthorized', ['Invalid email or password.']))
    render(<AccountPage />, { wrapper: MemoryRouter })

    await user.type(screen.getByLabelText('Current password'), 'wrong-password')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.type(screen.getByLabelText('Confirm new password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(screen.getByLabelText('Current password')).toHaveValue('wrong-password')
  })
})
