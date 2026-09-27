import { useState } from 'react'
import { LoginRequest, User } from '../../types'
import { loginRequest, getLoginErrorMessage } from '../auth'
import { useAuthStore } from '../../store/authStore'

/**
 * Hook de autenticación. Usa el mismo contrato que LoginPage
 * (loginRequest) y sincroniza el store global, que persiste token y usuario.
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = async (credentials: LoginRequest) => {
    setLoading(true)
    setError(null)
    try {
      const { token, user: userData } = await loginRequest(credentials)
      const store = useAuthStore.getState()
      store.setToken(token)
      store.setUser(userData)
      setUser(userData)
      return { success: true, token }
    } catch (err: any) {
      const errorMessage = getLoginErrorMessage(err, 'Login failed')
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    useAuthStore.getState().logout()
    setUser(null)
  }

  return { user, loading, error, login, logout }
}
