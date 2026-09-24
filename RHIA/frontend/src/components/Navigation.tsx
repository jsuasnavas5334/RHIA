import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Button } from './common/Button'

export const Navigation: React.FC = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-blue-600">RHIA</h1>
            </Link>
            {user && (
              <div className="flex gap-6 items-center">
                <Link
                  to="/dashboard"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to="/leads"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  Leads
                </Link>
                <Link
                  to="/automation"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  Automatización
                </Link>
                <Link
                  to="/reports"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  Reportes
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user.nombre_completo}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.rol}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  Salir
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button size="sm">Ingresar</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
