import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HowToUsePage } from './HowToUsePage'

const authMock = vi.hoisted(() => ({
  user: null as unknown,
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => authMock,
}))

describe('HowToUsePage', () => {
  beforeEach(() => {
    authMock.user = null
  })

  it('renders platform roles and onboarding guidance for public visitors', () => {
    render(<HowToUsePage />, { wrapper: MemoryRouter })

    expect(screen.getByRole('heading', { name: 'How To Use' })).toBeInTheDocument()
    expect(screen.getByText('A quick guide to the MerHouse fulfillment coordination platform.')).toBeInTheDocument()
    
    // Check platform roles section
    expect(screen.getByRole('heading', { name: 'Platform Roles' })).toBeInTheDocument()
    const merchantElements = screen.getAllByText(/Merchant/i)
    expect(merchantElements.length).toBeGreaterThan(0)
    const warehouseOperatorElements = screen.getAllByText(/Warehouse Operator/i)
    expect(warehouseOperatorElements.length).toBeGreaterThan(0)
    const ownerAdminElements = screen.getAllByText(/Owner \/ Admin/i)
    expect(ownerAdminElements.length).toBeGreaterThan(0)
    
    // Check getting started section
    expect(screen.getByRole('heading', { name: /Getting Started/i })).toBeInTheDocument()
    
    // Check footer links for unauthenticated users
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/sign-up')
  })

  it('shows authenticated footer with back link for signed-in users', () => {
    authMock.user = {
      id: 'user-id',
      email: 'merchant@merhouse.local',
      role: 'MERCHANT',
      enabled: true,
    }

    render(<HowToUsePage />, { wrapper: MemoryRouter })

    const backLinks = screen.getAllByRole('link', { name: /Back to app/i })
    expect(backLinks.length).toBeGreaterThan(0)
    expect(backLinks[0]).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
  })
})
