import { render, screen } from '@testing-library/react'
import { Shield } from 'lucide-react'
import { PublicAuthPanel } from './PublicAuthPanel'
import { BrandMark } from './BrandMark'
import { ThemeContext } from '../theme/ThemeContextValue'

const baseThemeState = {
  preference: 'system' as const,
  resolvedTheme: 'light' as const,
  setPreference: vi.fn(),
  toggleTheme: vi.fn(),
}

describe('PublicAuthPanel', () => {
  it('renders title, subtitle, and icon', () => {
    render(
      <ThemeContext.Provider value={baseThemeState}>
        <PublicAuthPanel
          title="Sign in"
          subtitle="Access your MerHouse workspace"
          icon={Shield}
          cues={[{ label: 'Access boundary', detail: 'Only enabled accounts can sign in.' }]}
        >
          <form aria-label="login form">Form content</form>
        </PublicAuthPanel>
      </ThemeContext.Provider>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText('Access your MerHouse workspace')).toBeInTheDocument()
    expect(screen.getByText('MerHouse')).toBeInTheDocument()
  })

  it('renders all cues in a description list', () => {
    render(
      <ThemeContext.Provider value={baseThemeState}>
        <PublicAuthPanel
          title="Test"
          subtitle="Sub"
          icon={Shield}
          cues={[
            { label: 'Cue 1', detail: 'Detail 1' },
            { label: 'Cue 2', detail: 'Detail 2' },
          ]}
        >
          <div>Content</div>
        </PublicAuthPanel>
      </ThemeContext.Provider>,
    )

    const cueList = screen.getByLabelText('Public account workflow guardrails')
    expect(cueList).toBeInTheDocument()
    expect(cueList).toHaveTextContent('Cue 1')
    expect(cueList).toHaveTextContent('Detail 1')
    expect(cueList).toHaveTextContent('Cue 2')
    expect(cueList).toHaveTextContent('Detail 2')
  })

  it('renders children content', () => {
    render(
      <ThemeContext.Provider value={baseThemeState}>
        <PublicAuthPanel title="T" subtitle="S" icon={Shield} cues={[]}>
          <form aria-label="my form">
            <input type="text" />
          </form>
        </PublicAuthPanel>
      </ThemeContext.Provider>,
    )

    expect(screen.getByRole('form', { name: 'my form' })).toBeInTheDocument()
  })

  it('renders footer navigation when provided', () => {
    render(
      <ThemeContext.Provider value={baseThemeState}>
        <PublicAuthPanel
          title="T"
          subtitle="S"
          icon={Shield}
          cues={[]}
          footer={<a href="/help">Help</a>}
        >
          <div>Content</div>
        </PublicAuthPanel>
      </ThemeContext.Provider>,
    )

    const footerNav = screen.getByRole('navigation', { name: 'Account help' })
    expect(footerNav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help')
  })

  it('does not render footer navigation when not provided', () => {
    render(
      <ThemeContext.Provider value={baseThemeState}>
        <PublicAuthPanel title="T" subtitle="S" icon={Shield} cues={[]}>
          <div>Content</div>
        </PublicAuthPanel>
      </ThemeContext.Provider>,
    )

    expect(screen.queryByRole('navigation', { name: 'Account help' })).not.toBeInTheDocument()
  })

  it('includes a theme toggle', () => {
    render(
      <ThemeContext.Provider value={baseThemeState}>
        <PublicAuthPanel title="T" subtitle="S" icon={Shield} cues={[]}>
          <div>Content</div>
        </PublicAuthPanel>
      </ThemeContext.Provider>,
    )

    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
  })

  it('renders in a main landmark with login-page class', () => {
    render(
      <ThemeContext.Provider value={baseThemeState}>
        <PublicAuthPanel title="T" subtitle="S" icon={Shield} cues={[]}>
          <div>Content</div>
        </PublicAuthPanel>
      </ThemeContext.Provider>,
    )

    expect(screen.getByRole('main')).toHaveClass('login-page', 'public-auth-page')
  })

  it('handles empty cues array without crashing', () => {
    render(
      <ThemeContext.Provider value={baseThemeState}>
        <PublicAuthPanel title="T" subtitle="S" icon={Shield} cues={[]}>
          <div>Content</div>
        </PublicAuthPanel>
      </ThemeContext.Provider>,
    )

    const cueList = screen.getByLabelText('Public account workflow guardrails')
    expect(cueList.children).toHaveLength(0)
  })
})

describe('BrandMark', () => {
  it('renders an accessible SVG with the MerHouse label', () => {
    render(<BrandMark />)

    const svg = screen.getByRole('img', { name: 'MerHouse' })
    expect(svg).toBeInTheDocument()
    expect(svg.tagName.toLowerCase()).toBe('svg')
  })

  it('renders path elements for the brand icon', () => {
    const { container } = render(<BrandMark />)
    const paths = container.querySelectorAll('svg path')
    expect(paths.length).toBeGreaterThanOrEqual(3)
  })
})
