import { useState, useCallback } from 'react'
import api from '../client'
import { DashboardMetrics } from '../../types'

export const useDashboard = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<DashboardMetrics>('/crm/dashboard')
      setMetrics(response.data)
      return response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al obtener las métricas del dashboard'
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { metrics, loading, error, fetchMetrics }
}
