import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AutomationPage from '../AutomationPage'

const apiGet = vi.fn()
const apiPost = vi.fn()
const apiPut = vi.fn()
const apiDelete = vi.fn()
vi.mock('../../api/client', () => ({
  default: {
    get: (...a: any[]) => apiGet(...a),
    post: (...a: any[]) => apiPost(...a),
    put: (...a: any[]) => apiPut(...a),
    delete: (...a: any[]) => apiDelete(...a),
  },
}))

const rules = [
  {
    id: 1,
    nombre: 'Email bienvenida',
    descripcion: 'Envía email a nuevos leads',
    condicion: '',
    accion: '',
    frecuencia: 'immediate',
    activo: true,
    total_ejecuciones: 5,
    conteo_ejecuciones: 12,
    ultima_ejecucion: '2026-09-20T10:00:00Z',
  },
  {
    id: 2,
    nombre: 'Seguimiento semanal',
    condicion: '',
    accion: '',
    frecuencia: 'weekly_monday',
    activo: false,
    total_ejecuciones: 7,
  },
]

const apiError = (detail: string) => ({ response: { data: { detail } } })

describe('AutomationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGet.mockResolvedValue({ data: { data: rules } })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads and lists the rules', async () => {
    render(<AutomationPage />)
    expect(await screen.findByText('Email bienvenida')).toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledWith('/automation/rules')
    expect(screen.getByText('Seguimiento semanal')).toBeInTheDocument()
    expect(screen.getByText('Inmediata')).toBeInTheDocument()
    expect(screen.getByText('Semanal')).toBeInTheDocument()
  })

  it('shows Activa/Inactiva badges instead of lead statuses (regression)', async () => {
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(screen.getByText('Inactiva')).toBeInTheDocument()
    expect(screen.queryByText('Ganado')).not.toBeInTheDocument()
    expect(screen.queryByText('Perdido')).not.toBeInTheDocument()
  })

  it('falls back to total_ejecuciones when conteo_ejecuciones is missing', async () => {
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('shows the empty state when there are no rules', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } })
    render(<AutomationPage />)
    expect(
      await screen.findByText('No hay reglas de automatización configuradas')
    ).toBeInTheDocument()
  })

  it('shows the API error when loading fails', async () => {
    apiGet.mockRejectedValue(apiError('Sin permisos'))
    render(<AutomationPage />)
    expect(await screen.findByText('Sin permisos')).toBeInTheDocument()
  })

  it('requires a rule name before creating', async () => {
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    fireEvent.click(screen.getByRole('button', { name: /nueva regla/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear Regla' }))
    expect(await screen.findByText('El nombre de la regla es obligatorio')).toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('cancel closes the form and clears the validation error', async () => {
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    fireEvent.click(screen.getByRole('button', { name: /nueva regla/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear Regla' }))
    await screen.findByText('El nombre de la regla es obligatorio')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('El nombre de la regla es obligatorio')).not.toBeInTheDocument()
    expect(screen.queryByText('Crear Nueva Regla de Automatización')).not.toBeInTheDocument()
  })

  it('creates a rule, closes the form and reloads the list', async () => {
    apiPost.mockResolvedValue({ data: {} })
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    fireEvent.click(screen.getByRole('button', { name: /nueva regla/i }))
    fireEvent.change(screen.getByPlaceholderText('Ej: Enviar email a nuevos leads'), {
      target: { value: 'Nueva regla X' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear Regla' }))
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        '/automation/rules',
        expect.objectContaining({ nombre: 'Nueva regla X', frecuencia: 'immediate', activo: true })
      )
    )
    await waitFor(() =>
      expect(screen.queryByText('Crear Nueva Regla de Automatización')).not.toBeInTheDocument()
    )
    expect(apiGet).toHaveBeenCalledTimes(2)
  })

  it('keeps the form mounted while creating the first rule (regression)', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } })
    apiPost.mockReturnValue(new Promise(() => {})) // queda pendiente
    render(<AutomationPage />)
    await screen.findByText('No hay reglas de automatización configuradas')
    fireEvent.click(screen.getByRole('button', { name: /nueva regla/i }))
    fireEvent.change(screen.getByPlaceholderText('Ej: Enviar email a nuevos leads'), {
      target: { value: 'Primera' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear Regla' }))
    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    expect(screen.queryByText('Cargando automatizaciones...')).not.toBeInTheDocument()
    expect(screen.getByText('Crear Nueva Regla de Automatización')).toBeInTheDocument()
  })

  it('shows the API error when creation fails and keeps the form', async () => {
    apiPost.mockRejectedValue(apiError('Nombre duplicado'))
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    fireEvent.click(screen.getByRole('button', { name: /nueva regla/i }))
    fireEvent.change(screen.getByPlaceholderText('Ej: Enviar email a nuevos leads'), {
      target: { value: 'Email bienvenida' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear Regla' }))
    expect(await screen.findByText('Nombre duplicado')).toBeInTheDocument()
    expect(screen.getByText('Crear Nueva Regla de Automatización')).toBeInTheDocument()
  })

  it('toggles a rule with the inverted activo flag', async () => {
    apiPut.mockResolvedValue({ data: {} })
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(
        '/automation/rules/1',
        expect.objectContaining({ id: 1, activo: false })
      )
    )
  })

  it('deletes a rule only after confirmation', async () => {
    apiDelete.mockResolvedValue({})
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0])
    expect(confirmSpy).toHaveBeenCalled()
    expect(apiDelete).not.toHaveBeenCalled()

    confirmSpy.mockReturnValueOnce(true)
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0])
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/automation/rules/1'))
  })

  it('ignores double clicks while a toggle request is pending (regression)', async () => {
    let resolvePut: (v: any) => void = () => {}
    apiPut.mockImplementation(() => new Promise((r) => (resolvePut = r)))
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    const toggle = screen.getByRole('button', { name: 'Desactivar' })
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(apiPut).toHaveBeenCalledTimes(1)
    // Todos los botones de reglas quedan deshabilitados mientras tanto
    screen.getAllByRole('button', { name: 'Eliminar' }).forEach((b) => expect(b).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Activar' })).toBeDisabled()
    resolvePut({ data: {} })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Desactivar' })).not.toBeDisabled()
    )
    expect(apiPut).toHaveBeenCalledTimes(1)
  })

  it('ignores a second delete while the first is pending (regression)', async () => {
    let resolveDelete: (v: any) => void = () => {}
    apiDelete.mockImplementation(() => new Promise((r) => (resolveDelete = r)))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    const del = screen.getAllByRole('button', { name: 'Eliminar' })[0]
    fireEvent.click(del)
    fireEvent.click(del)
    expect(apiDelete).toHaveBeenCalledTimes(1)
    resolveDelete({})
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))
  })

  it('re-enables the rule buttons after a failed toggle', async () => {
    apiPut.mockRejectedValue(apiError('No autorizado'))
    render(<AutomationPage />)
    await screen.findByText('Email bienvenida')
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    expect(await screen.findByText('No autorizado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desactivar' })).not.toBeDisabled()
    screen.getAllByRole('button', { name: 'Eliminar' }).forEach((b) => expect(b).not.toBeDisabled())
  })
})
