import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal, ConfirmDialog } from '../Modal'

describe('Modal Component', () => {
  it('renders modal content when open', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <div>Modal content</div>
      </Modal>
    )
    expect(screen.getByText('Modal content')).toBeTruthy()
  })

  it('does not render when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}}>
        <div>Modal content</div>
      </Modal>
    )
    expect(container.querySelector('[class*="fixed"]')).toBeFalsy()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    const { container } = render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Content</div>
      </Modal>
    )

    const backdrop = container.querySelector('[class*="fixed"]')
    await user.click(backdrop!)
    expect(handleClose).toHaveBeenCalled()
  })

  it('applies size variants', () => {
    const { container, rerender } = render(
      <Modal isOpen={true} onClose={() => {}} size="sm">
        <div>Content</div>
      </Modal>
    )
    expect(container.querySelector('[class*="max-w-sm"]')).toBeTruthy()

    rerender(
      <Modal isOpen={true} onClose={() => {}} size="lg">
        <div>Content</div>
      </Modal>
    )
    expect(container.querySelector('[class*="max-w-2xl"]')).toBeTruthy()
  })

  it('renders title when provided', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Modal Title">
        <div>Content</div>
      </Modal>
    )
    expect(screen.getByText('Modal Title')).toBeTruthy()
  })
})

describe('ConfirmDialog Component', () => {
  it('renders confirm dialog content', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm Action"
        message="Are you sure?"
      />
    )
    expect(screen.getByText('Confirm Action')).toBeTruthy()
    expect(screen.getByText('Are you sure?')).toBeTruthy()
  })

  it('has cancel and confirm buttons', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm"
        message="Are you sure?"
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={handleConfirm}
        title="Confirm"
        message="Proceed?"
        confirmText="Yes"
      />
    )

    const confirmButton = screen.getByText('Yes')
    await user.click(confirmButton)
    expect(handleConfirm).toHaveBeenCalled()
  })

  it('calls onClose when cancel button clicked', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={() => {}}
        title="Confirm"
        message="Proceed?"
        cancelText="No"
      />
    )

    const cancelButton = screen.getByText('No')
    await user.click(cancelButton)
    expect(handleClose).toHaveBeenCalled()
  })
})
