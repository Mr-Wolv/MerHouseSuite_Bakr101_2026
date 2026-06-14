import { render, screen } from '@testing-library/react'
import { useAuth } from './useAuth'

function ErrorProbe() {
  try {
    useAuth()
    return <div>OK</div>
  } catch (error) {
    return <div>{(error as Error).message}</div>
  }
}

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    render(<ErrorProbe />)
    expect(screen.getByText('useAuth must be used inside AuthProvider')).toBeInTheDocument()
  })
})
