import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createBrowserRouter } from 'react-router'

const { mockRouterProvider, mockToaster, mockQueryClientProvider } = vi.hoisted(() => ({
  mockRouterProvider: vi.fn(),
  mockToaster: vi.fn(),
  mockQueryClientProvider: vi.fn(),
}))

vi.mock('react-router', () => ({
  createBrowserRouter: vi.fn(() => 'mock-router'),
}))

vi.mock('react-router/dom', () => ({
  RouterProvider: (props: { router: unknown }) => {
    mockRouterProvider(props)
    return <div data-testid="router-provider">router</div>
  },
}))

vi.mock('sonner', () => ({
  Toaster: (props: Record<string, unknown>) => {
    mockToaster(props)
    return <div data-testid="toaster" />
  },
}))

vi.mock('@tanstack/react-query', () => ({
  QueryClientProvider: (props: Record<string, unknown>) => {
    mockQueryClientProvider(props)
    return <div data-testid="query-client-provider">{props.children as React.ReactNode}</div>
  },
}))

vi.mock('@/lib/query-client', () => ({
  queryClient: { mount: vi.fn(), unmount: vi.fn() },
}))

vi.mock('@/components/Layout', () => ({ Layout: () => <div>layout</div> }))
vi.mock('@/pages/LandingPage', () => ({ LandingPage: () => <div>landing</div> }))
vi.mock('@/pages/EventPage', () => ({ EventPage: () => <div>event</div> }))

describe('App', () => {
  beforeEach(() => {
    mockRouterProvider.mockClear()
    mockToaster.mockClear()
    mockQueryClientProvider.mockClear()
  })

  it('renders RouterProvider and passes route config with correct structure', async () => {
    const { App } = await import('./app')
    render(<App />)

    expect(screen.getByTestId('router-provider')).toBeInTheDocument()

    // Verify the router was passed through
    expect(mockRouterProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        router: 'mock-router',
      }),
    )

    // Verify createBrowserRouter was called with the correct route config
    const mockCreateBrowserRouter = vi.mocked(createBrowserRouter)
    expect(mockCreateBrowserRouter).toHaveBeenCalledTimes(1)

    const routeConfig = mockCreateBrowserRouter.mock.calls[0][0] as Array<{
      path?: string
      children?: Array<{ path?: string; index?: boolean; element?: unknown }>
      element?: unknown
    }>

    // Exactly one root route
    expect(routeConfig).toHaveLength(1)

    // Root route has path "/"
    expect(routeConfig[0].path).toBe('/')

    // Root route has an element (Layout)
    expect(routeConfig[0]).toHaveProperty('element')

    // Children array exists with exactly 2 children
    expect(routeConfig[0].children).toBeDefined()
    expect(routeConfig[0].children).toHaveLength(2)

    // First child is the index route (LandingPage)
    const indexRoute = routeConfig[0].children![0]
    expect(indexRoute).toHaveProperty('index', true)
    expect(indexRoute).toHaveProperty('element')

    // Second child is the event route
    const eventRoute = routeConfig[0].children![1]
    expect(eventRoute).toHaveProperty('path', 'event/:eventId')
    expect(eventRoute).toHaveProperty('element')
  })

  it('renders Toaster with theme="dark", position="top-center", and richColors', async () => {
    const { App } = await import('./app')
    render(<App />)

    expect(screen.getByTestId('toaster')).toBeInTheDocument()

    expect(mockToaster).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'dark',
        position: 'top-center',
        richColors: true,
      }),
    )
  })

  it('wraps content in QueryClientProvider with the queryClient', async () => {
    const { App } = await import('./app')
    render(<App />)

    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
    expect(mockQueryClientProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        client: expect.objectContaining({ mount: expect.any(Function) }),
      }),
    )
  })
})
