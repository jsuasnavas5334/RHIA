import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from '../../client'
import { useLeads, useLead } from '../useLeads'

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const lead = (id: number, name = `Lead ${id}`) => ({ id, name } as any)
const apiError = (detail?: string) => ({ response: { data: detail ? { detail } : {} } })

describe('useLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchLeads stores leads and total and passes filters as params', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { leads: [lead(1), lead(2)], total: 2 } })
    const { result } = renderHook(() => useLeads())
    await act(async () => { await result.current.fetchLeads({ page: 2, status: 'new' as any }) })
    expect(mockApi.get).toHaveBeenCalledWith('/leads', { params: { page: 2, status: 'new' } })
    expect(result.current.leads).toHaveLength(2)
    expect(result.current.total).toBe(2)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('fetchLeads sets API detail as error and returns empty result', async () => {
    mockApi.get.mockRejectedValueOnce(apiError('Boom'))
    const { result } = renderHook(() => useLeads())
    let ret: any
    await act(async () => { ret = await result.current.fetchLeads() })
    expect(ret).toEqual({ leads: [], total: 0 })
    expect(result.current.error).toBe('Boom')
    expect(result.current.loading).toBe(false)
  })

  it('fetchLeads falls back to default error message', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useLeads())
    await act(async () => { await result.current.fetchLeads() })
    expect(result.current.error).toBe('Error al obtener los leads')
  })

  it('createLead prepends the new lead', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { leads: [lead(1)], total: 1 } })
    mockApi.post.mockResolvedValueOnce({ data: lead(2) })
    const { result } = renderHook(() => useLeads())
    await act(async () => { await result.current.fetchLeads() })
    let ret: any
    await act(async () => { ret = await result.current.createLead({ name: 'Lead 2' } as any) })
    expect(ret).toEqual({ success: true, lead: lead(2) })
    expect(result.current.leads.map(l => l.id)).toEqual([2, 1])
  })

  it('keeps both leads when two creates run before a re-render (no stale closure)', async () => {
    mockApi.post.mockResolvedValueOnce({ data: lead(1) }).mockResolvedValueOnce({ data: lead(2) })
    const { result } = renderHook(() => useLeads())
    const create = result.current.createLead
    await act(async () => {
      await Promise.all([create({} as any), create({} as any)])
    })
    expect(result.current.leads.map(l => l.id).sort()).toEqual([1, 2])
  })

  it('updateLead replaces the matching lead only', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { leads: [lead(1), lead(2)], total: 2 } })
    mockApi.put.mockResolvedValueOnce({ data: lead(2, 'Updated') })
    const { result } = renderHook(() => useLeads())
    await act(async () => { await result.current.fetchLeads() })
    await act(async () => { await result.current.updateLead(2, { name: 'Updated' } as any) })
    expect(mockApi.put).toHaveBeenCalledWith('/leads/2', { name: 'Updated' })
    expect(result.current.leads.map((l: any) => l.name)).toEqual(['Lead 1', 'Updated'])
  })

  it('deleteLead removes the lead; failure keeps list and sets error', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { leads: [lead(1), lead(2)], total: 2 } })
    mockApi.delete.mockResolvedValueOnce({}).mockRejectedValueOnce(apiError())
    const { result } = renderHook(() => useLeads())
    await act(async () => { await result.current.fetchLeads() })
    await act(async () => { await result.current.deleteLead(1) })
    expect(result.current.leads.map(l => l.id)).toEqual([2])
    let ret: any
    await act(async () => { ret = await result.current.deleteLead(2) })
    expect(ret).toEqual({ success: false, error: 'Error al eliminar el lead' })
    expect(result.current.leads.map(l => l.id)).toEqual([2])
  })
})

describe('useLead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getLead loads a single lead', async () => {
    mockApi.get.mockResolvedValueOnce({ data: lead(5) })
    const { result } = renderHook(() => useLead(5))
    await act(async () => { await result.current.getLead() })
    expect(mockApi.get).toHaveBeenCalledWith('/leads/5')
    expect(result.current.lead).toEqual(lead(5))
  })

  it('does nothing when leadId is 0', async () => {
    const { result } = renderHook(() => useLead(0))
    let ret: any
    await act(async () => { ret = await result.current.getLead() })
    expect(ret).toBeNull()
    expect(mockApi.get).not.toHaveBeenCalled()
  })

  it('updateLead throws with API detail on failure', async () => {
    mockApi.put.mockRejectedValueOnce(apiError('Invalid'))
    const { result } = renderHook(() => useLead(3))
    await act(async () => {
      await expect(result.current.updateLead({} as any)).rejects.toThrow('Invalid')
    })
    expect(result.current.error).toBe('Invalid')
    expect(result.current.loading).toBe(false)
  })

  it('deleteLead clears the lead', async () => {
    mockApi.get.mockResolvedValueOnce({ data: lead(3) })
    mockApi.delete.mockResolvedValueOnce({})
    const { result } = renderHook(() => useLead(3))
    await act(async () => { await result.current.getLead() })
    await act(async () => { await result.current.deleteLead() })
    expect(result.current.lead).toBeNull()
  })
})
