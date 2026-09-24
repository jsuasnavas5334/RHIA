import React, { useState } from 'react'
import { Input } from '../common/Input'
import { Button } from '../common/Button'
import { LoginRequest } from '../../types'

interface LoginFormProps {
  onSubmit: (credentials: LoginRequest) => Promise<void>
  isLoading?: boolean
  error?: string
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  isLoading = false,
  error,
}) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (!email || !password) {
      setLocalError('Por favor completa todos los campos')
      return
    }

    try {
      await onSubmit({ email, password })
    } catch (err) {
      setLocalError(error || 'Error en la autenticación')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Ingresar a RHIA
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Plataforma de Automatización de Ventas
        </p>
      </div>

      {(localError || error) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
          <p className="text-sm text-red-700 dark:text-red-400">
            {localError || error}
          </p>
        </div>
      )}

      <Input
        label="Correo Electrónico"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@empresa.com"
        required
        disabled={isLoading}
      />

      <Input
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        required
        disabled={isLoading}
      />

      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={isLoading}
        className="w-full"
      >
        {isLoading ? 'Ingresando...' : 'Ingresar'}
      </Button>

      <div className="text-center text-xs text-gray-500 dark:text-gray-400">
        <p>Demo: usa cualquier correo y contraseña durante desarrollo</p>
      </div>
    </form>
  )
}
