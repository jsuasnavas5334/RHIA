import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { Toast, ToastType } from '../Toast'

const renderToast = (
  type: ToastType,
  message: string,
  onClose = vi.fn(),
  duration?: number
) =>
  render(<Toast toast={{ id: 't1', type, message, duration }} onClose={onClose} />)

describe('Toast Component', () => {
  it('renders success toast', () => {
    renderToast('success', 'Operation successful')
    expect(screen.getByText('Operation successful')).toBeTruthy()
  })

  it('renders error toast', () => {
    renderToast('error', 'An error occurred')
    expect(screen.getByText('An error occurred')).toBeTruthy()
  })

  it('renders warning toast', () => {
    renderToast('warning', 'Warning message')
    expect(screen.getByText('Warning message')).toBeTruthy()
  })

  it('renders info toast', () => {
    renderToast('info', 'Info message')
    expect(screen.getByText('Info message')).toBeTruthy()
  })

  it('applies correct styling for success type', () => {
    const { container } = renderToast('success', 'Success')
    expect(container.querySelector('[class*="bg-green"]')).toBeTruthy()
  })

  it('applies correct styling for error type', () => {
    const { container } = renderToast('error', 'Error')
    expect(container.querySelector('[class*="bg-red"]')).toBeTruthy()
  })

  it('close button calls onClose with id', () => {
    const handleClose = vi.fn()
    renderToast('success', 'Test', handleClose)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(handleClose).toHaveBeenCalledWith('t1')
  })

  it('dismisses after specified duration', async () => {
    const handleClose = vi.fn()
    renderToast('success', 'Test', handleClose, 300)
    await waitFor(() => expect(handleClose).toHaveBeenCalledWith('t1'), { timeout: 1500 })
  })
})
