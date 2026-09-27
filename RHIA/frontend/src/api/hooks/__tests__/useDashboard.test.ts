import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDashboard } from '../useDashboard'

const apiGet = vi.fn()
vi.mock('../../client', () => ({
  default: { get: (...a: any[]) => apiGet(...a) },
}))

const metrics = { total_leads: 10, leads_ganados: 2 }

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts empty and not loading', () => {
    const { result } = renderHook(() => useDashboard())
    expect(result.current.metrics).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('fetches metrics from /crm/dashboard and stores them', async () => {
    apiGet.mockResolvedValue({ data: metrics })
    const { result } = renderHook(() => useDashboard())
    let ret: any
    await act(async () => {
      ret = await result.current.fetchMetrics()
    })
    expect(apiGet).toHaveBeenCalledWith('/crm/dashboard')
    expect(ret).toEqual(metrics)
    expect(result.current.metrics).toEqual(metrics)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets loading while the request is pending', async () => {
    let resolve!: (v: any) => void
    apiGet.mockReturnValue(new Promise((r) => (resolve = r)))
    const { result } = renderHook(() => useDashboard())
    let p: Promise<any>
    act(() => {
      p = result.current.fetchMetrics()
    })
    expect(result.current.loading).toBe(true)
    await act(async () => {
      resolve({ data: metrics })
      await p
    })
    expect(result.current.loading).toBe(false)
  })

  it('stores the API detail on error and returns null', async () => {
    apiGet.mockRejectedValue({ response: { data: { detail: 'No autorizado' } } })
    const { result } = renderHook(() => useDashboard())
    let ret: any = 'x'
    await act(async () => {
      ret = await result.current.fetchMetrics()
    })
    expect(ret).toBeNull()
    expect(result.current.error).toBe('No autorizado')
    expect(result.current.loading).toBe(false)
  })

  it('uses a Spanish fallback message when there is no detail', async () => {
    apiGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useDashboard())
    await act(async () => {
      await result.current.fetchMetrics()
    })
    expect(result.current.error).toBe('Error al obtener las métricas del dashboard')
  })

  it('clears a previous error on a successful retry', async () => {
    apiGet
      .mockRejectedValueOnce({ response: { data: { detail: 'Temporal' } } })
      .mockResolvedValueOnce({ data: metrics })
    const { result } = renderHook(() => useDashboard())
    await act(async () => {
      await result.current.fetchMetrics()
    })
    expect(result.current.error).toBe('Temporal')
    await act(async () => {
      await result.current.fetchMetrics()
    })
    expect(result.current.error).toBeNull()
    expect(result.current.metrics).toEqual(metrics)
  })
})
