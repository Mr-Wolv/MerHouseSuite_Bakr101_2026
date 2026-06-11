import { render, screen } from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom'
import { NotFoundPage, RouteErrorPage } from './NotFoundPage'

describe('route fallbacks', () => {
  it('shows a workspace-safe not-found page instead of framework error copy', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'This workspace route is not available' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to your workspace' })).toHaveAttribute('href', '/')
    expect(screen.queryByText(/Unexpected Application Error/i)).not.toBeInTheDocument()
  })

  it('renders route errors as operational guidance', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        errorElement: <RouteErrorPage />,
        loader: () => {
          throw new Response('Not found', { status: 404, statusText: 'Not Found' })
        },
        element: <div>Should not render</div>,
      },
    ])

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'We could not open that page' })).toBeInTheDocument()
    expect(screen.getByText('That page or operational record is not available to this account.')).toBeInTheDocument()
    expect(screen.queryByText(/Hey developer/i)).not.toBeInTheDocument()
  })
})
