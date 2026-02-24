import { describe, it, expect, vi, beforeEach } from 'vitest'

let capturedHeartbeatCallback: ((status: string) => void) | undefined
let capturedOptions: Record<string, unknown> | undefined
let capturedUrl: string | undefined
let capturedKey: string | undefined

const { mockConnect } = vi.hoisted(() => ({
  mockConnect: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, key: string, options?: Record<string, unknown>) => {
    capturedUrl = url
    capturedKey = key
    capturedOptions = options
    const realtimeOpts = options?.realtime as { heartbeatCallback?: (status: string) => void } | undefined
    if (realtimeOpts?.heartbeatCallback) {
      capturedHeartbeatCallback = realtimeOpts.heartbeatCallback
    }
    return {
      realtime: {
        connect: mockConnect,
        worker: (options?.realtime as Record<string, unknown>)?.worker,
      },
    }
  },
}))

// Set up import.meta.env values before importing the module
vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key-12345')

describe('supabase client initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedHeartbeatCallback = undefined
    capturedOptions = undefined
    capturedUrl = undefined
    capturedKey = undefined
    vi.resetModules()
  })

  it('creates client with env URL and anon key', async () => {
    await import('./supabase')
    expect(capturedUrl).toBe('https://test-project.supabase.co')
    expect(capturedKey).toBe('test-anon-key-12345')
  })

  it('configures realtime worker as true', async () => {
    await import('./supabase')
    const realtimeOpts = capturedOptions?.realtime as Record<string, unknown>
    expect(realtimeOpts?.worker).toBe(true)
  })

  it('heartbeatCallback calls connect() when status is "disconnected"', async () => {
    await import('./supabase')
    expect(capturedHeartbeatCallback).toBeDefined()

    capturedHeartbeatCallback!('disconnected')

    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it('heartbeatCallback does NOT call connect() when status is "connected"', async () => {
    await import('./supabase')
    expect(capturedHeartbeatCallback).toBeDefined()

    capturedHeartbeatCallback!('connected')

    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('heartbeatCallback does NOT call connect() when status is "error"', async () => {
    await import('./supabase')
    expect(capturedHeartbeatCallback).toBeDefined()

    capturedHeartbeatCallback!('error')

    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('heartbeatCallback does NOT call connect() for empty string status', async () => {
    await import('./supabase')
    expect(capturedHeartbeatCallback).toBeDefined()

    capturedHeartbeatCallback!('')

    expect(mockConnect).not.toHaveBeenCalled()
  })
})
