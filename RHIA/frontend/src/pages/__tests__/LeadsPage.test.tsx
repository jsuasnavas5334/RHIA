import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LeadsPage from '../LeadsPage'
import { useLeadsStore } from '../../store/leadsStore'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
vi.mock('../../context/ToastContext', () => ({ useToastContext: () => toast }))

const exportLeadsToCSV = vi.fn()
vi.mock('../../utils/csv', () => ({
  exportLeadsToCSV: (...args: any[]) => exportLeadsToCSV(...args),
}))

const fetchLeads = vi.fn()
const updateLead = vi.fn()
const deleteLead = vi.fn()
let hookState: any

vi.mock('../../api/hooks/useLeads', () => ({
  useLeads: () => ({ ...hookState, fetchLeads, updateLead, deleteLead }),
}))

const makeLead = (id: number, empresa: string) => ({
  id,
  empresa_nombre: empresa,
  industria: 'Retail',
  contacto_nombre: `Contacto ${id}`,
  contacto_email: `c${id}@x.com`,
  estado: 'nuevo',
  fecha_creacion: '2026-09-01',
})

const sampleLeads = [makeLead(1, 'Acme'), makeLead(2, 'Globex')]

// checkboxes: [0] = seleccionar todo, [1..n] = una fila cada uno
const checkboxes = () => screen.getAllByRole('checkbox')

describe('LeadsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookState = { leads: sampleLeads, total: 2, loading: false, error: null }
    useLeadsStore.setState({ filters: {}, currentPage: 1, perPage: 20 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches leads on mount with page params', () => {
    render(<LeadsPage />)
    expect(fetchLeads).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, per_page: 20 })
    )
  })

  it('shows the loader while loading with no leads', () => {
    hookState = { leads: [], total: 0, loading: true, error: null }
    render(<LeadsPage />)
    expect(screen.getByText('Cargando leads...')).toBeInTheDocument()
  })

  it('renders leads, count and error message', () => {
    hookState = { ...hookState, error: 'Falla API' }
    render(<LeadsPage />)
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Globex')).toBeInTheDocument()
    expect(screen.getByText('2 de 2')).toBeInTheDocument()
    expect(screen.getByText('Error: Falla API')).toBeInTheDocument()
  })

  it('empty-state row spans all 6 columns', () => {
    hookState = { leads: [], total: 0, loading: false, error: null }
    render(<LeadsPage />)
    const cell = screen.getByText('No hay leads con esos filtros')
    expect(cell.getAttribute('colspan')).toBe('6')
  })

  it('refetches with status filter', () => {
    render(<LeadsPage />)
    const select = screen.getByDisplayValue('Todos los estados')
    fireEvent.change(select, { target: { value: 'ganado' } })
    expect(fetchLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ganado', page: 1 })
    )
  })

  it('select all toggles every row and shows bulk bar', () => {
    render(<LeadsPage />)
    fireEvent.click(checkboxes()[0])
    expect(screen.getByText('2 leads seleccionados')).toBeInTheDocument()
    fireEvent.click(checkboxes()[0])
    expect(screen.queryByText(/seleccionados?$/)).not.toBeInTheDocument()
  })

  it('exports only selected leads', () => {
    render(<LeadsPage />)
    fireEvent.click(checkboxes()[2])
    fireEvent.click(screen.getByText(/Exportar/))
    expect(exportLeadsToCSV).toHaveBeenCalledWith([sampleLeads[1]], expect.stringMatching(/^leads-.*\.csv$/))
    expect(toast.success).toHaveBeenCalledWith('1 leads exportados exitosamente')
  })

  it('warns when there is nothing to export', () => {
    hookState = { leads: [], total: 0, loading: false, error: null }
    render(<LeadsPage />)
    fireEvent.click(screen.getByText(/Exportar/))
    expect(exportLeadsToCSV).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith('No hay leads para exportar')
  })

  it('single delete shows success only when the API succeeds', async () => {
    deleteLead.mockResolvedValue({ success: true })
    render(<LeadsPage />)
    fireEvent.click(screen.getAllByText('Eliminar')[0])
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Lead eliminado exitosamente'))
    expect(deleteLead).toHaveBeenCalledWith(1)
  })

  it('single delete shows error when the API fails (regression)', async () => {
    deleteLead.mockResolvedValue({ success: false, error: 'No autorizado' })
    render(<LeadsPage />)
    fireEvent.click(screen.getAllByText('Eliminar')[0])
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No autorizado'))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('does not delete when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<LeadsPage />)
    fireEvent.click(screen.getAllByText('Eliminar')[0])
    expect(deleteLead).not.toHaveBeenCalled()
  })

  it('bulk delete counts failures separately (regression)', async () => {
    deleteLead
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'x' })
    render(<LeadsPage />)
    fireEvent.click(checkboxes()[0])
    // en la barra masiva el botón "Eliminar" es el primero
    fireEvent.click(screen.getAllByText('Eliminar')[0])
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('1 leads eliminados'))
    expect(toast.error).toHaveBeenCalledWith('1 leads no se pudieron eliminar')
    expect(deleteLead).toHaveBeenCalledTimes(2)
  })

  it('bulk status change calls updateLead for each selected lead', async () => {
    updateLead.mockResolvedValue({ success: true })
    render(<LeadsPage />)
    fireEvent.click(checkboxes()[0])
    fireEvent.change(screen.getByDisplayValue('Cambiar estado a...'), { target: { value: 'ganado' } })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('2 leads actualizados a ganado'))
    expect(updateLead).toHaveBeenCalledWith(1, expect.objectContaining({ id: 1, estado: 'ganado' }))
    expect(updateLead).toHaveBeenCalledWith(2, expect.objectContaining({ id: 2, estado: 'ganado' }))
  })

  it('bulk status change reports failures', async () => {
    updateLead.mockResolvedValue({ success: false, error: 'x' })
    render(<LeadsPage />)
    fireEvent.click(checkboxes()[1])
    fireEvent.change(screen.getByDisplayValue('Cambiar estado a...'), { target: { value: 'perdido' } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('1 leads no se pudieron actualizar'))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('navigates to new lead and lead detail', () => {
    render(<LeadsPage />)
    fireEvent.click(screen.getByText('+ Nuevo Lead'))
    expect(navigate).toHaveBeenCalledWith('/leads/new')
    fireEvent.click(screen.getAllByText('Ver')[1])
    expect(navigate).toHaveBeenCalledWith('/leads/2')
  })

  it('paginates when total exceeds perPage', () => {
    hookState = { ...hookState, total: 45 }
    render(<LeadsPage />)
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    expect(screen.getByText('← Anterior')).toBeDisabled()
    fireEvent.click(screen.getByText('Siguiente →'))
    expect(useLeadsStore.getState().currentPage).toBe(2)
  })
})
