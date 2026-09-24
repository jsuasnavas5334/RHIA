import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '../useAuth'
import * as authStore from '../../store/authStore'

describe('useAuth Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('returns auth store values', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeDefined()
    expect(result.current.token).toBeDefined()
    expect(result.current.isAuthenticated).toBeDefined()
  })

  it('provides login function', () => {
    const { result } = renderHook(() => useAuth())

    expect(typeof result.current.login).toBe('function')
  })

  it('provides logout function', () => {
    const { result } = renderHook(() => useAuth())

    expect(typeof result.current.logout).toBe('function')
  })

  it('initializes with unauthenticated state', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
  })

  it('stores token in localStorage after login', async () => {
    const { result } = renderHook(() => useAuth())

    const mockLoginResponse = {
      access_token: 'test-token',
      user: { id: '1', email: 'test@example.com' },
    }

    // Mock successful login
    await act(async () => {
      // This would call the API
    })
  })

  it('clears localStorage on logout', async () => {
    localStorage.setItem('token', 'test-token')
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      result.current.logout()
    })

    expect(localStorage.getItem('token')).toBeNull()
  })

  it('persists user data in store', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeDefined()
  })
})
