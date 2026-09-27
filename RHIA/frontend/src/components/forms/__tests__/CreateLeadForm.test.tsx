import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateLeadForm } from '../CreateLeadForm'

const empresa = () => screen.getByPlaceholderText('Nombre de la empresa') as HTMLInputElement
const email = () => screen.getByPlaceholderText('contacto@empresa.com') as HTMLInputElement
const tamano = () => screen.getByPlaceholderText('0') as HTMLInputElement
const submitForm = (container: HTMLElement) => fireEvent.submit(container.querySelector('form')!)

describe('CreateLeadForm', () => {
  it('renders the four sections and the submit button', () => {
    render(<CreateLeadForm onSubmit={vi.fn()} />)
    expect(screen.getByText('Información de la Empresa')).toBeInTheDocument()
    expect(screen.getByText('Información del Contacto')).toBeInTheDocument()
    expect(screen.getByText('Oportunidad / Vacante')).toBeInTheDocument()
    expect(screen.getByText('Análisis y Propuesta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear Lead' })).toBeInTheDocument()
  })

  it('shows validation error and does not submit when empresa/email are empty', async () => {
    const onSubmit = vi.fn()
    const { container } = render(<CreateLeadForm onSubmit={onSubmit} />)
    submitForm(container)
    expect(await screen.findByText(/Empresa y Email son obligatorios/)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the form data when required fields are filled', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<CreateLeadForm onSubmit={onSubmit} />)
    fireEvent.change(empresa(), { target: { value: 'Acme' } })
    fireEvent.change(email(), { target: { value: 'ana@acme.com' } })
    fireEvent.change(tamano(), { target: { value: '120' } })
    submitForm(container)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.empresa_nombre).toBe('Acme')
    expect(payload.contacto_email).toBe('ana@acme.com')
    expect(payload.tamano_empleados).toBe(120)
    expect(payload.confianza_analisis).toBe(50)
  })

  it('never sends NaN when the number field is cleared (regression)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<CreateLeadForm onSubmit={onSubmit} />)
    fireEvent.change(empresa(), { target: { value: 'Acme' } })
    fireEvent.change(email(), { target: { value: 'ana@acme.com' } })
    fireEvent.change(tamano(), { target: { value: '15' } })
    fireEvent.change(tamano(), { target: { value: '' } })
    submitForm(container)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(Number.isNaN(onSubmit.mock.calls[0][0].tamano_empleados)).toBe(false)
    expect(onSubmit.mock.calls[0][0].tamano_empleados).toBe(0)
  })

  it('updates the confidence label when the slider moves', () => {
    render(<CreateLeadForm onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '80' } })
    expect(screen.getByText(/Confianza en el Análisis: 80%/)).toBeInTheDocument()
  })

  it('shows a fallback error when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('boom'))
    const { container } = render(<CreateLeadForm onSubmit={onSubmit} />)
    fireEvent.change(empresa(), { target: { value: 'Acme' } })
    fireEvent.change(email(), { target: { value: 'ana@acme.com' } })
    submitForm(container)
    expect(await screen.findByText('Error al crear el lead')).toBeInTheDocument()
  })

  it('renders the error prop from the parent', () => {
    render(<CreateLeadForm onSubmit={vi.fn()} error="Email duplicado" />)
    expect(screen.getByText('Email duplicado')).toBeInTheDocument()
  })

  it('disables inputs and shows loading state when isLoading', () => {
    render(<CreateLeadForm onSubmit={vi.fn()} isLoading />)
    expect(empresa()).toBeDisabled()
    expect(screen.getByRole('button', { name: /Cargando/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })
})
