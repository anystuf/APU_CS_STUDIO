import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './firebaseAuth'

describe('Firebase authentication messages', () => {
  it('explains migration when credentials are rejected', () => {
    expect(authErrorMessage({ code: 'auth/invalid-credential' })).toContain('Firebase password')
  })
  it('guides existing accounts to recovery, not another signup', () => {
    expect(authErrorMessage({ code: 'auth/email-already-in-use' })).toContain('Forgot password')
  })
  it('does not encourage retrying rate-limited email requests', () => {
    expect(authErrorMessage({ code: 'auth/too-many-requests' })).toContain('wait')
  })
  it('preserves actionable bridge errors', () => {
    expect(authErrorMessage(new Error('Confirm your email'))).toBe('Confirm your email')
  })
})
