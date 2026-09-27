import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ROUTER_FUTURE_FLAGS } from '../../routerConfig'
import { Navigation } from '../Navigation'
import { useAuthStore } from '../../store/authStore'

const loginAs = () =>
  useAuthStore.setState({
    user: { id: 1, email: 'ana@rhia.com', nombre_completo: 'Ana Pérez', rol: 'admin', activo: true },
    token: 't',
    isAuthenticated: true,
  })

const renderNav = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']} future={ROUTER_FUTURE_FLAGS}>
      <Navigation />
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>
  )

describe('Navigation Component', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
  })

  it('renders navigation bar with logo', () => {
    renderNav()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByText('RHIA')).toBeInTheDocument()
  })

  it('shows "Ingresar" and hides links when logged out', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument()
    expect(screen.queryByText('Leads')).not.toBeInTheDocument()
  })

  it('renders navigation links when logged in', () => {
    loginAs()
    renderNav()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leads' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Automatización' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reportes' })).toBeInTheDocument()
  })

  it('shows user name and role', () => {
    loginAs()
    renderNav()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('has theme classes', () => {
    const { container } = renderNav()
    expect(container.querySelector('nav')).toHaveClass('bg-white', 'dark:bg-slate-900')
  })

  it('logout clears the session and navigates to /login', async () => {
    const user = userEvent.setup()
    loginAs()
    renderNav()
    await user.click(screen.getByRole('button', { name: /salir/i }))
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })
})
