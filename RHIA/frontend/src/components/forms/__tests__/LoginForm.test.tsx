import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../LoginForm'

const getEmail = () => screen.getByPlaceholderText('tu@empresa.com') as HTMLInputElement
const getPassword = () => screen.getByPlaceholderText('••••••••') as HTMLInputElement
const getSubmit = () => screen.getByRole('button', { name: /ingres/i })

describe('LoginForm Component', () => {
  it('renders email and password inputs', () => {
    render(<LoginForm onSubmit={vi.fn()} />)
    expect(getEmail()).toBeInTheDocument()
    expect(getEmail().type).toBe('email')
    expect(getPassword()).toBeInTheDocument()
    expect(getPassword().type).toBe('password')
  })

  it('renders submit button', () => {
    render(<LoginForm onSubmit={vi.fn()} />)
    expect(getSubmit()).toHaveTextContent('Ingresar')
  })

  it('shows validation error when fields are empty', async () => {
    const onSubmit = vi.fn()
    const { container } = render(<LoginForm onSubmit={onSubmit} />)
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findByText(/completa todos los campos/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows validation error when password is missing', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<LoginForm onSubmit={onSubmit} />)
    await user.type(getEmail(), 'test@example.com')
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findByText(/completa todos los campos/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits form with valid credentials', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<LoginForm onSubmit={onSubmit} />)
    await user.type(getEmail(), 'test@example.com')
    await user.type(getPassword(), 'password123')
    await user.click(getSubmit())
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' })
    )
  })

  it('displays loading state', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(getEmail()).toBeDisabled()
    expect(getPassword()).toBeDisabled()
  })

  it('displays error passed via props', () => {
    render(<LoginForm onSubmit={vi.fn()} error="Credenciales inválidas" />)
    expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument()
  })

  it('displays fallback error when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('401'))
    const user = userEvent.setup()
    render(<LoginForm onSubmit={onSubmit} />)
    await user.type(getEmail(), 'wrong@example.com')
    await user.type(getPassword(), 'wrongpassword')
    await user.click(getSubmit())
    expect(await screen.findByText(/error en la autenticación/i)).toBeInTheDocument()
  })
})
