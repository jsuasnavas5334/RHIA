import React from 'react'
import { Card } from './common/Card'
import { Button } from './common/Button'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">
              Algo salió mal
            </h2>
            <p className="text-red-600 dark:text-red-300 mb-4">
              {this.state.error?.message || 'Se produjo un error inesperado'}
            </p>
            <Button
              variant="danger"
              onClick={() => window.location.reload()}
            >
              Recargar página
            </Button>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
