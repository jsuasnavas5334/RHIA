import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportsPage from '../ReportsPage'

const apiGet = vi.fn()
vi.mock('../../api/client', () => ({
  default: { get: (...a: any[]) => apiGet(...a) },
}))

const conversion = {
  total_leads: 200,
  leads_contactados: 100,
  leads_respondieron: 40,
  leads_ganados: 20,
  leads_perdidos: 30,
  tasa_conversion: 10,
}
const industries = [
  { industria: 'Retail', cantidad_leads: 120, tasa_conversion: 12.345 },
  { industria: 'Salud', cantidad_leads: 80, tasa_conversion: 7 },
]

const mockApi = (conv: any, ind: any) =>
  apiGet.mockImplementation((url: string) =>
    url === '/crm/reports/conversion'
      ? Promise.resolve({ data: conv })
      : Promise.resolve({ data: { data: ind } })
  )

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the loader while reports are loading', () => {
    apiGet.mockReturnValue(new Promise(() => {}))
    render(<ReportsPage />)
    expect(screen.getByText('Cargando reportes...')).toBeInTheDocument()
  })

  it('requests both report endpoints', async () => {
    mockApi(conversion, industries)
    render(<ReportsPage />)
    await screen.findByText('Reportes y Análisis')
    expect(apiGet).toHaveBeenCalledWith('/crm/reports/conversion')
    expect(apiGet).toHaveBeenCalledWith('/crm/reports/by-industry')
  })

  it('renders conversion stats and computed rates', async () => {
    mockApi(conversion, industries)
    render(<ReportsPage />)
    await screen.findByText('Embudo de Conversión')
    expect(screen.getByText('Leads Totales')).toBeInTheDocument()
    expect(screen.getAllByText('200').length).toBeGreaterThan(0)
    // Tasa de contacto 100/200, respuesta 40/100, cierre 20/200
    expect(screen.getByText('Tasa de Contacto').nextElementSibling).toHaveTextContent('50.0%')
    expect(screen.getByText('Tasa de Respuesta').nextElementSibling).toHaveTextContent('40.0%')
    expect(screen.getByText('Tasa de Cierre').nextElementSibling).toHaveTextContent('10.0%')
  })

  it('renders the industry table with one decimal', async () => {
    mockApi(conversion, industries)
    render(<ReportsPage />)
    expect(await screen.findByText('Desempeño por Industria')).toBeInTheDocument()
    expect(screen.getByText('Retail')).toBeInTheDocument()
    expect(screen.getByText('12.3%')).toBeInTheDocument()
    expect(screen.getByText('7.0%')).toBeInTheDocument()
  })

  it('never shows NaN when there are zero leads (regression)', async () => {
    mockApi(
      { ...conversion, total_leads: 0, leads_contactados: 0, leads_respondieron: 0, leads_ganados: 0, leads_perdidos: 0 },
      []
    )
    const { container } = render(<ReportsPage />)
    await screen.findByText('Embudo de Conversión')
    expect(container.textContent).not.toMatch(/NaN|Infinity/)
    container.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
      expect(el.style.width).not.toMatch(/NaN|Infinity/)
    })
  })

  it('handles a missing industry conversion rate without crashing', async () => {
    mockApi(conversion, [{ industria: 'Legal', cantidad_leads: 3, tasa_conversion: null }])
    render(<ReportsPage />)
    expect(await screen.findByText('Legal')).toBeInTheDocument()
    expect(screen.getByText('0.0%')).toBeInTheDocument()
  })

  it('hides the industry table when there is no industry data', async () => {
    mockApi(conversion, [])
    render(<ReportsPage />)
    await screen.findByText('Embudo de Conversión')
    expect(screen.queryByText('Desempeño por Industria')).not.toBeInTheDocument()
  })

  it('shows the API error message when loading fails', async () => {
    apiGet.mockRejectedValue({ response: { data: { detail: 'Servidor caído' } } })
    render(<ReportsPage />)
    expect(await screen.findByText('Servidor caído')).toBeInTheDocument()
    expect(screen.queryByText('Embudo de Conversión')).not.toBeInTheDocument()
  })

  it('uses a fallback error message when the API gives no detail', async () => {
    apiGet.mockRejectedValue(new Error('network'))
    render(<ReportsPage />)
    expect(await screen.findByText('Error al cargar reportes')).toBeInTheDocument()
  })
})
