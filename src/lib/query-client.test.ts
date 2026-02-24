import { describe, it, expect } from 'vitest'
import { queryClient } from './query-client'

describe('query-client default options', () => {
  const defaults = queryClient.getDefaultOptions()

  describe('query defaults', () => {
    it('sets staleTime to 30000ms', () => {
      expect(defaults.queries?.staleTime).toBe(30_000)
    })

    it('sets gcTime to 300000ms (5 minutes)', () => {
      expect(defaults.queries?.gcTime).toBe(300_000)
    })

    it('sets retry to 2', () => {
      expect(defaults.queries?.retry).toBe(2)
    })

    it('enables refetchOnWindowFocus', () => {
      expect(defaults.queries?.refetchOnWindowFocus).toBe(true)
    })
  })

  describe('mutation defaults', () => {
    it('sets retry to 1', () => {
      expect(defaults.mutations?.retry).toBe(1)
    })
  })
})
