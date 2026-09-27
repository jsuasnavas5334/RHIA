import React, { Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { Navigation } from './components/Navigation'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/common/Toast'
import { useToast } from './hooks/useToast'
import { ToastProvider } from './context/ToastContext'
import { ROUTER_FUTURE_FLAGS } from './routerConfig'

// Eager load (needed immediately)
import { LoginPage } from './pages/LoginPage'

// Lazy load (loaded on demand)
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const LeadsPage = React.lazy(() => import('./pages/LeadsPage'))
const LeadDetailPage = React.lazy(() => import('./pages/LeadDetailPage'))
const CreateLeadPage = React.lazy(() => import('./pages/CreateLeadPage'))
const AutomationPage = React.lazy(() => import('./pages/AutomationPage'))
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'))

import './styles/index.css'
import './styles/animations.css'

// Loading fallback component
const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
    <div className="text-center">
      <div className="inline-block">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
      <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando...</p>
    </div>
  </div>
)

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
        <Router future={ROUTER_FUTURE_FLAGS}>
          <div className="min-h-screen bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
            <Navigation />
            <ToastContainer toasts={toasts} onClose={removeToast} />
            <Suspense fallback={<PageLoader />}>
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
            </Suspense>
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  )
}
