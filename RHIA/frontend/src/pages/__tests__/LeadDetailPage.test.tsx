import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LeadDetailPage from '../LeadDetailPage'

const navigate = vi.fn()
let routeId: string | undefined = '7'
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ id: routeId }),
}))

// Se usa el hook real useLead; solo se mockea el cliente HTTP.
const apiGet = vi.fn()
const apiPut = vi.fn()
vi.mock('../../api/client', () => ({
  default: {
    get: (...a: any[]) => apiGet(...a),
    put: (...a: any[]) => apiPut(...a),
    delete: vi.fn(),
  },
}))

const baseLead = {
  id: 7,
  empresa_nombre: 'Acme',
  industria: 'Retail',
  contacto_nombre: 'Ana Pérez',
  contacto_email: 'ana@acme.com',
  estado: 'nuevo',
  notas: 'Primera nota',
  fecha_creacion: '2026-09-01',
}

const apiError = (detail: string) => ({ response: { data: { detail } } })

const renderLoaded = async () => {
  render(<LeadDetailPage />)
  await screen.findByText('Ana Pérez')
}

describe('LeadDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeId = '7'
    apiGet.mockResolvedValue({ data: baseLead })
  })

  it('loads the lead by route id and renders its data', async () => {
    await renderLoaded()
    expect(apiGet).toHaveBeenCalledWith('/leads/7')
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('ana@acme.com')).toBeInTheDocument()
    expect(screen.getByText('Primera nota')).toBeInTheDocument()
    // teléfono y fuente ausentes → N/A
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(2)
  })

  it('shows a full-page error when the initial load fails', async () => {
    apiGet.mockRejectedValue(apiError('Lead inexistente'))
    render(<LeadDetailPage />)
    expect(await screen.findByText('Error: Lead inexistente')).toBeInTheDocument()
    expect(screen.queryByText('Cambiar Estado')).not.toBeInTheDocument()
  })

  it('shows "Lead no encontrado" for an invalid id without calling the API', () => {
    routeId = 'abc'
    render(<LeadDetailPage />)
    expect(screen.getByText('Lead no encontrado')).toBeInTheDocument()
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('changes status via PUT with the full lead', async () => {
    apiPut.mockResolvedValue({ data: { ...baseLead, estado: 'ganado' } })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'ganado' }))
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/leads/7', { ...baseLead, estado: 'ganado' })
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'ganado' })).not.toBeDisabled())
  })

  it('keeps the page mounted while an update is in flight (regression)', async () => {
    let resolvePut: (v: any) => void = () => {}
    apiPut.mockReturnValue(new Promise((r) => { resolvePut = r }))
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'contactado' }))
    await waitFor(() => expect(apiPut).toHaveBeenCalled())
    // antes: `loading` del hook reemplazaba toda la página por el Loader
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('Cambiar Estado')).toBeInTheDocument()
    resolvePut({ data: { ...baseLead, estado: 'contactado' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'contactado' })).not.toBeDisabled())
  })

  it('shows an inline error and keeps the lead visible when an update fails (regression)', async () => {
    apiPut.mockRejectedValue(apiError('No autorizado'))
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'perdido' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Error: No autorizado')
    // antes: la página completa se reemplazaba por el error y el lead desaparecía
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('Cambiar Estado')).toBeInTheDocument()
  })

  it('appends a note to existing notes and clears the input', async () => {
    const updated = { ...baseLead, notas: 'Primera nota\nLlamar el lunes' }
    apiPut.mockResolvedValue({ data: updated })
    await renderLoaded()
    const input = screen.getByPlaceholderText('Agregar nota...')
    fireEvent.change(input, { target: { value: 'Llamar el lunes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/leads/7', expect.objectContaining({ notas: 'Primera nota\nLlamar el lunes' }))
    )
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('keeps the typed note when saving it fails', async () => {
    apiPut.mockRejectedValue(apiError('Error updating lead'))
    await renderLoaded()
    const input = screen.getByPlaceholderText('Agregar nota...')
    fireEvent.change(input, { target: { value: 'Nota importante' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await screen.findByRole('alert')
    expect(screen.getByPlaceholderText('Agregar nota...')).toHaveValue('Nota importante')
  })

  it('ignores empty notes', async () => {
    await renderLoaded()
    fireEvent.change(screen.getByPlaceholderText('Agregar nota...'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('navigates back to the leads list', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(navigate).toHaveBeenCalledWith('/leads')
  })

  it('renders vacancy and email stats sections when present', async () => {
    apiGet.mockResolvedValue({
      data: {
        ...baseLead,
        vacante_titulo: 'Gerente RRHH',
        vacante_descripcion: 'Liderar equipo',
        vacante_url: 'https://example.com/v',
        email_generado: 'Hola...',
        email_abierto: true,
        email_clicks: 3,
      },
    })
    await renderLoaded()
    expect(screen.getByText('Gerente RRHH')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver vacante' })).toHaveAttribute('href', 'https://example.com/v')
    expect(screen.getByText('Estadísticas de Email')).toBeInTheDocument()
    expect(screen.getByText('Sí')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does not send a PUT when clicking the current status', async () => {
    await renderLoaded()
    const current = screen.getByRole('button', { name: 'nuevo' })
    expect(current).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(current)
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('only the clicked status shows loading and all actions lock while it saves (regression)', async () => {
    let resolvePut: (v: any) => void = () => {}
    apiPut.mockReturnValue(new Promise((r) => { resolvePut = r }))
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'ganado' }))
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1))
    // antes: los 5 botones mostraban "Cargando..." y perdían su etiqueta
    expect(screen.getAllByText('Cargando...')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'perdido' })).toBeDisabled()
    // antes: "Agregar" seguía activo y un PUT de nota pisaba el cambio de estado
    fireEvent.change(screen.getByPlaceholderText('Agregar nota...'), { target: { value: 'x' } })
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'perdido' }))
    expect(apiPut).toHaveBeenCalledTimes(1)
    resolvePut({ data: { ...baseLead, estado: 'ganado' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agregar' })).not.toBeDisabled())
  })

  it('locks status buttons while a note is being saved (regression)', async () => {
    let resolvePut: (v: any) => void = () => {}
    apiPut.mockReturnValue(new Promise((r) => { resolvePut = r }))
    await renderLoaded()
    fireEvent.change(screen.getByPlaceholderText('Agregar nota...'), { target: { value: 'Nota' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'ganado' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'ganado' }))
    expect(apiPut).toHaveBeenCalledTimes(1)
    resolvePut({ data: { ...baseLead, notas: 'Primera nota\nNota' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'ganado' })).not.toBeDisabled())
  })

  it('submits the note with Enter', async () => {
    apiPut.mockResolvedValue({ data: { ...baseLead, notas: 'Primera nota\nPor Enter' } })
    await renderLoaded()
    const input = screen.getByPlaceholderText('Agregar nota...')
    fireEvent.change(input, { target: { value: 'Por Enter' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/leads/7', expect.objectContaining({ notas: 'Primera nota\nPor Enter' }))
    )
    await waitFor(() => expect(input).toHaveValue(''))
  })
})
