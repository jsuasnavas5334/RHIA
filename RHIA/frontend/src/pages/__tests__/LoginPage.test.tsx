import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ROUTER_FUTURE_FLAGS } from '../../routerConfig'
import { LoginPage } from '../LoginPage'
import { useAuthStore } from '../../store/authStore'

vi.mock('../../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/auth')>()
  return { ...actual, loginRequest: vi.fn() }
})

import { loginRequest } from '../../api/auth'
const mockedLogin = vi.mocked(loginRequest)

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/login']} future={ROUTER_FUTURE_FLAGS}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard destino</div>} />
      </Routes>
    </MemoryRouter>
  )

const fillAndSubmit = async () => {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('tu@empresa.com'), 'ana@empresa.com')
  await user.type(screen.getByPlaceholderText('••••••••'), 'secreto123')
  await user.click(screen.getByRole('button', { name: /ingres/i }))
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockedLogin.mockReset()
    useAuthStore.getState().logout()
  })

  it('renders the login form and footer', () => {
    renderPage()
    expect(screen.getByPlaceholderText('tu@empresa.com')).toBeInTheDocument()
    expect(screen.getByText(/Brivé Soluciones/)).toBeInTheDocument()
  })

  it('logs in, stores token/user and navigates to dashboard', async () => {
    const user = { id: 1, email: 'ana@empresa.com', name: 'Ana' } as any
    mockedLogin.mockResolvedValue({ token: 'tok-123', user })
    renderPage()
    await fillAndSubmit()
    expect(await screen.findByText('Dashboard destino')).toBeInTheDocument()
    expect(mockedLogin).toHaveBeenCalledWith({ email: 'ana@empresa.com', password: 'secreto123' })
    const state = useAuthStore.getState()
    expect(state.token).toBe('tok-123')
    expect(state.user).toEqual(user)
    expect(state.isAuthenticated).toBe(true)
  })

  it('shows backend detail on error and stays on login', async () => {
    mockedLogin.mockRejectedValue({ response: { data: { detail: 'Credenciales inválidas' } } })
    renderPage()
    await fillAndSubmit()
    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard destino')).not.toBeInTheDocument()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('shows fallback message when error has no detail', async () => {
    mockedLogin.mockRejectedValue({})
    renderPage()
    await fillAndSubmit()
    expect(await screen.findByText(/Verifica tus credenciales/)).toBeInTheDocument()
  })

  it('redirects to dashboard when already authenticated', async () => {
    useAuthStore.getState().setToken('existing')
    renderPage()
    await waitFor(() => expect(screen.getByText('Dashboard destino')).toBeInTheDocument())
  })
})
