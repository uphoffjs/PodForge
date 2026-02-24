import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Layout } from './Layout'

vi.mock('react-router', () => ({
  Outlet: () => <div data-testid="outlet">outlet content</div>,
}))

describe('Layout', () => {
  it('renders the Outlet component', () => {
    render(<Layout />)

    expect(screen.getByTestId('outlet')).toBeInTheDocument()
    expect(screen.getByTestId('outlet')).toHaveTextContent('outlet content')
  })

  it('has min-h-screen class on the wrapper div', () => {
    render(<Layout />)

    const wrapper = screen.getByTestId('outlet').parentElement
    expect(wrapper).toHaveClass('min-h-screen')
  })

  it('has bg-surface class on the wrapper div', () => {
    render(<Layout />)

    const wrapper = screen.getByTestId('outlet').parentElement
    expect(wrapper).toHaveClass('bg-surface')
  })

  it('has text-text-primary class on the wrapper div', () => {
    render(<Layout />)

    const wrapper = screen.getByTestId('outlet').parentElement
    expect(wrapper).toHaveClass('text-text-primary')
  })

  it('has font-body class on the wrapper div', () => {
    render(<Layout />)

    const wrapper = screen.getByTestId('outlet').parentElement
    expect(wrapper).toHaveClass('font-body')
  })
})
