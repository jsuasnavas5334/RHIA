import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore, USER_KEY } from '../authStore'
import type { User } from '../../types'

const user: User = {
  id: 1,
  email: 'test@rhia.com',
  nombre_completo: 'Usuario Test',
  rol: 'admin',
  activo: true,
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
  })

  it('setToken persiste el token para el interceptor de axios', () => {
    useAuthStore.getState().setToken('abc123')
    expect(localStorage.setItem).toHaveBeenCalledWith('rhia_token', 'abc123')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('setUser persiste el usuario', () => {
    useAuthStore.getState().setUser(user)
    expect(localStorage.setItem).toHaveBeenCalledWith(USER_KEY, JSON.stringify(user))
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('logout limpia token y usuario del almacenamiento', () => {
    useAuthStore.setState({ user, token: 't', isAuthenticated: true })
    useAuthStore.getState().logout()
    expect(localStorage.removeItem).toHaveBeenCalledWith('rhia_token')
    expect(localStorage.removeItem).toHaveBeenCalledWith(USER_KEY)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('initFromStorage restaura token y usuario', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
      key === 'rhia_token' ? 'tok' : key === USER_KEY ? JSON.stringify(user) : null
    )
    useAuthStore.getState().initFromStorage()
    const s = useAuthStore.getState()
    expect(s.token).toBe('tok')
    expect(s.user).toEqual(user)
    expect(s.isAuthenticated).toBe(true)
  })

  it('initFromStorage no autentica sin token', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    useAuthStore.getState().initFromStorage()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
