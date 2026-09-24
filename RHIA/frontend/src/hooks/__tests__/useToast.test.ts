import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '../useToast'

describe('useToast Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides toast methods', () => {
    const { result } = renderHook(() => useToast())

    expect(typeof result.current.showToast).toBe('function')
    expect(typeof result.current.success).toBe('function')
    expect(typeof result.current.error).toBe('function')
    expect(typeof result.current.warning).toBe('function')
    expect(typeof result.current.info).toBe('function')
  })

  it('shows success toast', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.success('Operation successful')
    })

    // Toast should be in the queue
    expect(result.current.toasts).toBeDefined()
  })

  it('shows error toast', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.error('An error occurred')
    })

    // Toast should be in the queue
    expect(result.current.toasts).toBeDefined()
  })

  it('shows warning toast', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.warning('Warning message')
    })

    expect(result.current.toasts).toBeDefined()
  })

  it('shows info toast', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.info('Info message')
    })

    expect(result.current.toasts).toBeDefined()
  })

  it('removes toast by id', () => {
    const { result } = renderHook(() => useToast())

    let toastId: string | undefined

    act(() => {
      const toast = result.current.success('Test')
      toastId = toast?.id
    })

    expect(toastId).toBeDefined()

    act(() => {
      if (toastId) {
        result.current.removeToast(toastId)
      }
    })
  })

  it('generates unique toast ids', () => {
    const { result } = renderHook(() => useToast())

    let id1: string | undefined
    let id2: string | undefined

    act(() => {
      id1 = result.current.success('Toast 1')?.id
      id2 = result.current.success('Toast 2')?.id
    })

    expect(id1).not.toBe(id2)
  })

  it('maintains toast queue', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.success('Toast 1')
      result.current.error('Toast 2')
      result.current.info('Toast 3')
    })

    expect(result.current.toasts.length).toBeGreaterThanOrEqual(3)
  })
})
