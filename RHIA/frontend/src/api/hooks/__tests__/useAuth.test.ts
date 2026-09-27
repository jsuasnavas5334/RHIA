import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuth } from '../useAuth'

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns auth hook values', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('provides login function', () => {
    const { result } = renderHook(() => useAuth())
    expect(typeof result.current.login).toBe('function')
  })

  it('provides logout function', () => {
    const { result } = renderHook(() => useAuth())
    expect(typeof result.current.logout).toBe('function')
  })

  it('initializes with no user', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
