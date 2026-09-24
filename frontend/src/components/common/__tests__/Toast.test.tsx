import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Toast } from '../Toast'

describe('Toast Component', () => {
  it('renders success toast', () => {
    render(<Toast type="success" message="Operation successful" />)
    expect(screen.getByText('Operation successful')).toBeTruthy()
  })

  it('renders error toast', () => {
    render(<Toast type="error" message="An error occurred" />)
    expect(screen.getByText('An error occurred')).toBeTruthy()
  })

  it('renders warning toast', () => {
    render(<Toast type="warning" message="Warning message" />)
    expect(screen.getByText('Warning message')).toBeTruthy()
  })

  it('renders info toast', () => {
    render(<Toast type="info" message="Info message" />)
    expect(screen.getByText('Info message')).toBeTruthy()
  })

  it('applies correct styling for success type', () => {
    const { container } = render(
      <Toast type="success" message="Success" />
    )
    const toast = container.querySelector('[class*="bg-green"]')
    expect(toast).toBeTruthy()
  })

  it('applies correct styling for error type', () => {
    const { container } = render(
      <Toast type="error" message="Error" />
    )
    const toast = container.querySelector('[class*="bg-red"]')
    expect(toast).toBeTruthy()
  })

  it('has close button', () => {
    const handleClose = vi.fn()
    render(
      <Toast type="success" message="Test" onClose={handleClose} />
    )
    const closeButton = screen.getByRole('button')
    expect(closeButton).toBeTruthy()
  })

  it('dismisses after specified duration', async () => {
    const handleClose = vi.fn()
    render(
      <Toast
        type="success"
        message="Test"
        onClose={handleClose}
        duration={1000}
      />
    )

    await waitFor(
      () => expect(handleClose).toHaveBeenCalled(),
      { timeout: 1500 }
    )
  })
})
