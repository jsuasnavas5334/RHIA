import { useState, useCallback } from 'react'
import api from '../client'
import { Lead, LeadCreateRequest, LeadStatus } from '../../types'

export interface LeadsFilter {
  page?: number
  per_page?: number
  status?: LeadStatus
  industry?: string
  search?: string
}

export const useLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLeads = useCallback(async (filters: LeadsFilter = {}) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/leads', { params: filters })
      setLeads(response.data.leads || [])
      setTotal(response.data.total || 0)
      return response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al obtener los leads'
      setError(errorMessage)
      return { leads: [], total: 0 }
    } finally {
      setLoading(false)
    }
  }, [])

  const createLead = useCallback(async (leadData: LeadCreateRequest) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post<Lead>('/leads', leadData)
      setLeads(prev => [response.data, ...prev])
      return { success: true, lead: response.data }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al crear el lead'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  const updateLead = useCallback(async (leadId: number, leadData: Partial<Lead>) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.put<Lead>(`/leads/${leadId}`, leadData)
      setLeads(prev => prev.map(l => l.id === leadId ? response.data : l))
      return { success: true, lead: response.data }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al actualizar el lead'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteLead = useCallback(async (leadId: number) => {
    setLoading(true)
    setError(null)
    try {
      await api.delete(`/leads/${leadId}`)
      setLeads(prev => prev.filter(l => l.id !== leadId))
      return { success: true }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al eliminar el lead'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  return { leads, total, loading, error, fetchLeads, createLead, updateLead, deleteLead }
}

export const useLead = (leadId: number) => {
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getLead = useCallback(async () => {
    if (!leadId) return null
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<Lead>(`/leads/${leadId}`)
      setLead(response.data)
      return response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al obtener el lead'
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [leadId])

  const updateLead = useCallback(async (leadData: Partial<Lead>) => {
    if (!leadId) return null
    setLoading(true)
    setError(null)
    try {
      const response = await api.put<Lead>(`/leads/${leadId}`, leadData)
      setLead(response.data)
      return response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al actualizar el lead'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  const deleteLead = useCallback(async () => {
    if (!leadId) return null
    setLoading(true)
    setError(null)
    try {
      await api.delete(`/leads/${leadId}`)
      setLead(null)
      return true
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al eliminar el lead'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  return { lead, loading, error, getLead, updateLead, deleteLead }
}
