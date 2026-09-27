import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
}) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRoles && requiredRoles.length > 0) {
    // Sin usuario cargado no se pueden verificar roles: se niega el acceso
    // (fail-closed) y se pide volver a iniciar sesión.
    if (!user) {
      return <Navigate to="/login" replace />
    }
    if (!requiredRoles.includes(user.rol)) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  return <>{children}</>
}
