import { render, screen } from '@testing-library/react'
import { useAuth } from './useAuth'

function ErrorProbe() {
  let message: string
  try {
    useAuth()
    message = 'OK'
  } catch (error) {
    message = (error as Error).message
  }
  return <div>{message}</div>
}

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    render(<ErrorProbe />)
    expect(screen.getByText('useAuth must be used inside AuthProvider')).toBeInTheDocument()
  })
})
