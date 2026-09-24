import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LoginForm } from '../components/forms/LoginForm'
import { LoginRequest } from '../types'
import api from '../api/client'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { setUser, setToken, isAuthenticated } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleLogin = async (credentials: LoginRequest) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.post<{
        access_token: string
        user: {
          id: number
          email: string
          nombre_completo: string
          rol: string
          activo: boolean
        }
      }>('/auth/login', credentials)

      const { access_token, user } = response.data

      setToken(access_token)
      setUser(user)

      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.detail ||
        err.message ||
        'Error en la autenticación. Verifica tus credenciales.'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8">
          <LoginForm onSubmit={handleLogin} isLoading={isLoading} error={error} />
        </div>

        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            RHIA © {new Date().getFullYear()} -{' '}
            <span className="font-semibold">Brivé Soluciones</span>
          </p>
          <p className="mt-2">Plataforma de Automatización de Ventas B2B</p>
        </div>
      </div>
    </div>
  )
}
