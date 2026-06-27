import { describe, it, expect } from 'vitest'
import {
  isInvalidPassphraseError,
  INVALID_PASSPHRASE_RETRY_MESSAGE,
} from './passphrase-error'

describe('isInvalidPassphraseError', () => {
  it('returns true for an Error whose message contains "invalid passphrase"', () => {
    expect(isInvalidPassphraseError(new Error('invalid passphrase provided'))).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isInvalidPassphraseError(new Error('Invalid Passphrase'))).toBe(true)
  })

  it('returns false for an unrelated Error', () => {
    expect(isInvalidPassphraseError(new Error('event not found'))).toBe(false)
  })

  it('returns false for a non-Error value', () => {
    expect(isInvalidPassphraseError('invalid passphrase')).toBe(false)
    expect(isInvalidPassphraseError(null)).toBe(false)
    expect(isInvalidPassphraseError(undefined)).toBe(false)
    expect(isInvalidPassphraseError({ message: 'invalid passphrase' })).toBe(false)
  })
})

describe('INVALID_PASSPHRASE_RETRY_MESSAGE', () => {
  it('is a non-empty human-readable retry prompt', () => {
    expect(INVALID_PASSPHRASE_RETRY_MESSAGE).toBe('Invalid passphrase. Please re-enter to continue.')
  })
})
