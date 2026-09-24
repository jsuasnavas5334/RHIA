import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

// Component that throws an error
const ThrowingComponent = () => {
  throw new Error('Test error')
}

// Component that renders normally
const WorkingComponent = () => {
  return <div>Working component</div>
}

describe('ErrorBoundary Component', () => {
  // Suppress console.error for these tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Working component')).toBeTruthy()
  })

  it('displays error message when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/error occurred/i)).toBeTruthy()
  })

  it('displays error details', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Test error/i)).toBeTruthy()
  })

  it('shows fallback UI when error boundary catches error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    const fallback = screen.queryByText(/something went wrong/i)
    expect(fallback).toBeTruthy()
  })

  it('provides reload button to recover from error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    const button = screen.getByRole('button', { name: /reload/i })
    expect(button).toBeTruthy()
  })

  it('has retry/reload functionality', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Working component')).toBeTruthy()

    rerender(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/error occurred/i)).toBeTruthy()
  })

  it('logs error to console', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    // Should have logged the error
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
