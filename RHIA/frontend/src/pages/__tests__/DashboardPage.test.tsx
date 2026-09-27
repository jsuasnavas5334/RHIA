import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '../DashboardPage'

const fetchMetrics = vi.fn()
let hookState: any

vi.mock('../../api/hooks/useDashboard', () => ({
  useDashboard: () => ({ ...hookState, fetchMetrics }),
}))

const sampleMetrics = {
  total_leads: 40,
  new_leads_this_month: 7,
  conversion_rate: 12.5,
  won_leads: 5,
  response_rate: 33,
  leads_by_status: { nuevo: 20, contactado: 15, ganado: 5 },
  leads_by_industry: { Retail: 9, Salud: 8, Tech: 7, Banca: 6, Educación: 5, Minería: 4 },
  emails_sent_this_week: 120,
  emails_opened_this_week: 48,
  new_contacts_this_week: 11,
}

describe('DashboardPage', () => {
  beforeEach(() => {
    fetchMetrics.mockReset()
    hookState = { metrics: null, loading: false, error: null }
  })

  it('fetches metrics on mount', () => {
    render(<DashboardPage />)
    expect(fetchMetrics).toHaveBeenCalledTimes(1)
  })

  it('shows the loader while loading', () => {
    hookState = { metrics: null, loading: true, error: null }
    render(<DashboardPage />)
    expect(screen.getByText('Cargando dashboard...')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard de Ventas')).not.toBeInTheDocument()
  })

  it('shows the error message', () => {
    hookState = { metrics: null, loading: false, error: 'Servidor caído' }
    render(<DashboardPage />)
    expect(screen.getByText(/Error al cargar el dashboard: Servidor caído/)).toBeInTheDocument()
  })

  it('renders stat cards and weekly activity from metrics', () => {
    hookState = { metrics: sampleMetrics, loading: false, error: null }
    render(<DashboardPage />)
    expect(screen.getByText('Leads Totales')).toBeInTheDocument()
    expect(screen.getByText('12.5%')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument()
    expect(screen.getByText(/\+7 este mes/)).toBeInTheDocument()
    expect(screen.getByText(/de 40/)).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('48')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
  })

  it('lists leads by status and only the top 5 industries', () => {
    hookState = { metrics: sampleMetrics, loading: false, error: null }
    render(<DashboardPage />)
    expect(screen.getByText('contactado')).toBeInTheDocument()
    expect(screen.getByText('Educación')).toBeInTheDocument()
    expect(screen.queryByText('Minería')).not.toBeInTheDocument()
  })

  it('renders zeros and no stat cards when metrics are empty', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Dashboard de Ventas')).toBeInTheDocument()
    expect(screen.queryByText('Leads Totales')).not.toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(3)
  })
})
