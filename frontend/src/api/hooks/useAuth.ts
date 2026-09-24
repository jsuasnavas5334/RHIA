import { useState } from 'react'
import api, { setAuthToken, clearAuthToken } from '../client'
import { LoginRequest, LoginResponse, User } from '../../types'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = async (credentials: LoginRequest) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post<LoginResponse>('/auth/login', credentials)
      const { token, user: userData } = response.data

      setAuthToken(token)
      setUser(userData)

      return { success: true, token }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Login failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    clearAuthToken()
    setUser(null)
  }

  return { user, loading, error, login, logout }
}
