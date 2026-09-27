import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ROUTER_FUTURE_FLAGS } from '../../routerConfig'
import { ProtectedRoute } from '../ProtectedRoute'
import { useAuthStore } from '../../store/authStore'
import type { User } from '../../types'

const makeUser = (rol: string): User => ({
  id: 1,
  email: 'test@rhia.com',
  nombre_completo: 'Usuario Test',
  rol,
  activo: true,
})

const renderRoute = (roles: string[], content = 'Admin Content') =>
  render(
    <MemoryRouter initialEntries={['/']} future={ROUTER_FUTURE_FLAGS}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute requiredRoles={roles}>
              <div>{content}</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/unauthorized" element={<div>Unauthorized</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
  })

  it('renders children when authenticated with the required role', () => {
    useAuthStore.setState({ user: makeUser('admin'), token: 't', isAuthenticated: true })
    renderRoute(['admin'])
    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    renderRoute(['admin'])
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('redirects to /unauthorized when role does not match', () => {
    useAuthStore.setState({ user: makeUser('viewer'), token: 't', isAuthenticated: true })
    renderRoute(['admin'])
    expect(screen.getByText('Unauthorized')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('allows access when user has any of the required roles', () => {
    useAuthStore.setState({ user: makeUser('manager'), token: 't', isAuthenticated: true })
    renderRoute(['admin', 'manager'], 'Moderation Panel')
    expect(screen.getByText('Moderation Panel')).toBeInTheDocument()
  })

  it('redirects to /login when token exists but user is not loaded (fail-closed)', () => {
    useAuthStore.setState({ user: null, token: 't', isAuthenticated: true })
    renderRoute(['admin'])
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })
})
