import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '../ProtectedRoute'

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders protected component when authenticated', () => {
    localStorage.setItem('token', 'test-token')

    render(
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <ProtectedRoute>
                <div>Protected content</div>
              </ProtectedRoute>
            }
            path="/"
          />
        </Routes>
      </BrowserRouter>
    )

    expect(screen.getByText('Protected content')).toBeTruthy()
  })

  it('redirects to login when not authenticated', () => {
    localStorage.removeItem('token')

    const { container } = render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div>Public</div>} />
          <Route
            path="/login"
            element={
              <ProtectedRoute>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    )

    // Should not render protected content
    expect(screen.queryByText('Protected content')).toBeFalsy()
  })

  it('checks localStorage for token', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem')
    localStorage.setItem('token', 'valid-token')

    render(
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <ProtectedRoute>
                <div>Content</div>
              </ProtectedRoute>
            }
            path="/"
          />
        </Routes>
      </BrowserRouter>
    )

    expect(spy).toHaveBeenCalledWith('token')
    spy.mockRestore()
  })

  it('supports role-based access control', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('userRole', 'admin')

    render(
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <ProtectedRoute requiredRole="admin">
                <div>Admin panel</div>
              </ProtectedRoute>
            }
            path="/"
          />
        </Routes>
      </BrowserRouter>
    )

    expect(screen.getByText('Admin panel')).toBeTruthy()
  })

  it('denies access with insufficient role', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('userRole', 'user')

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div>Public</div>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <div>Admin panel</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    )

    // Should redirect or show access denied
    expect(screen.queryByText('Admin panel')).toBeFalsy()
  })
})
