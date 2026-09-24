import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { Navigation } from './components/Navigation'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/common/Toast'
import { useToast } from './hooks/useToast'
import { ToastProvider } from './context/ToastContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { LeadsPage } from './pages/LeadsPage'
import { LeadDetailPage } from './pages/LeadDetailPage'
import { CreateLeadPage } from './pages/CreateLeadPage'
import { AutomationPage } from './pages/AutomationPage'
import { ReportsPage } from './pages/ReportsPage'
import './styles/index.css'
import './styles/animations.css'

const UnauthorizedPage: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        403 - Acceso Denegado
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        No tienes permisos para acceder a esta página
      </p>
      <a
        href="/dashboard"
        className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Volver al Dashboard
      </a>
    </div>
  </div>
)

export const App: React.FC = () => {
  const { initFromStorage } = useAuthStore()
  const { toasts, removeToast } = useToast()

  useEffect(() => {
    initFromStorage()
  }, [])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
            <Navigation />
            <ToastContainer toasts={toasts} onClose={removeToast} />
            <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/leads"
            element={
              <ProtectedRoute>
                <LeadsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/leads/new"
            element={
              <ProtectedRoute>
                <CreateLeadPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/leads/:id"
            element={
              <ProtectedRoute>
                <LeadDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/automation"
            element={
              <ProtectedRoute>
                <AutomationPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  )
}
