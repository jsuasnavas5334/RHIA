import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CreateLeadPage from '../CreateLeadPage'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

// Se usa el hook real useLeads; solo se mockea el cliente HTTP.
const apiPost = vi.fn()
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: (...a: any[]) => apiPost(...a),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const fillRequired = () => {
  fireEvent.change(screen.getByPlaceholderText('Nombre de la empresa'), {
    target: { name: 'empresa_nombre', value: 'Acme' },
  })
  fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
    target: { name: 'contacto_nombre', value: 'Ana Pérez' },
  })
  fireEvent.change(screen.getByPlaceholderText('contacto@empresa.com'), {
    target: { name: 'contacto_email', value: 'ana@acme.com' },
  })
}

const submit = () =>
  fireEvent.submit(screen.getByRole('button', { name: /crear lead/i }).closest('form')!)

describe('CreateLeadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading and the form', () => {
    render(<CreateLeadPage />)
    expect(screen.getByRole('heading', { name: 'Crear Nuevo Lead' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear lead/i })).toBeInTheDocument()
  })

  it('posts the lead and navigates to /leads on success', async () => {
    apiPost.mockResolvedValue({ data: { id: 1, empresa_nombre: 'Acme' } })
    render(<CreateLeadPage />)
    fillRequired()
    submit()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/leads'))
    expect(apiPost).toHaveBeenCalledWith(
      '/leads',
      expect.objectContaining({
        empresa_nombre: 'Acme',
        contacto_nombre: 'Ana Pérez',
        contacto_email: 'ana@acme.com',
      })
    )
  })

  it('does NOT navigate and shows the API error when creation fails', async () => {
    apiPost.mockRejectedValue({ response: { data: { detail: 'Email duplicado' } } })
    render(<CreateLeadPage />)
    fillRequired()
    submit()
    expect(await screen.findByText('Email duplicado')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('re-enables the submit button after a failed creation', async () => {
    apiPost.mockRejectedValue({ response: { data: { detail: 'Fallo' } } })
    render(<CreateLeadPage />)
    fillRequired()
    submit()
    await screen.findByText('Fallo')
    expect(screen.getByRole('button', { name: /crear lead/i })).not.toBeDisabled()
  })

  it('uses a fallback message when the API gives no detail', async () => {
    apiPost.mockRejectedValue(new Error('network'))
    render(<CreateLeadPage />)
    fillRequired()
    submit()
    expect(await screen.findByText('Error al crear el lead')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('validates required fields without calling the API', async () => {
    render(<CreateLeadPage />)
    submit()
    expect(
      await screen.findByText('Los campos Empresa y Email son obligatorios')
    ).toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('clears a previous error on a successful retry', async () => {
    apiPost
      .mockRejectedValueOnce({ response: { data: { detail: 'Temporal' } } })
      .mockResolvedValueOnce({ data: { id: 2 } })
    render(<CreateLeadPage />)
    fillRequired()
    submit()
    await screen.findByText('Temporal')
    submit()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/leads'))
    expect(screen.queryByText('Temporal')).not.toBeInTheDocument()
  })
})
