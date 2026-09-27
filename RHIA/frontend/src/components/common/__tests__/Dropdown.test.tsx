import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dropdown, DropdownItem } from '../Dropdown'

describe('Dropdown Component', () => {
  const mockItems: DropdownItem[] = [
    { id: '1', label: 'Edit', onClick: vi.fn() },
    { id: '2', label: 'Delete', variant: 'danger', onClick: vi.fn() },
  ]

  const trigger = <button>Menu</button>

  it('renders trigger element', () => {
    render(<Dropdown items={mockItems} trigger={trigger} />)
    expect(screen.getByText('Menu')).toBeTruthy()
  })

  it('shows menu when trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<Dropdown items={mockItems} trigger={trigger} />)

    const triggerButton = screen.getByText('Menu')
    await user.click(triggerButton)

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeTruthy()
      expect(screen.getByText('Delete')).toBeTruthy()
    })
  })

  it('hides menu when trigger is clicked again', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Dropdown items={mockItems} trigger={trigger} />
    )

    const triggerButton = screen.getByText('Menu')
    await user.click(triggerButton)
    
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeTruthy()
    })

    await user.click(triggerButton)
    
    await waitFor(() => {
      const menu = container.querySelector('[class*="absolute"]')
      expect(menu).toBeFalsy()
    })
  })

  it('calls onClick handler when item is clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    const items: DropdownItem[] = [
      { id: '1', label: 'Click me', onClick: handleClick },
    ]

    render(<Dropdown items={items} trigger={trigger} />)
    
    const triggerButton = screen.getByText('Menu')
    await user.click(triggerButton)

    const item = screen.getByText('Click me')
    await user.click(item)

    await waitFor(() => {
      expect(handleClick).toHaveBeenCalled()
    })
  })

  it('closes menu after item is clicked', async () => {
    const user = userEvent.setup()
    const items: DropdownItem[] = [
      { id: '1', label: 'Option 1', onClick: vi.fn() },
    ]

    const { container } = render(
      <Dropdown items={items} trigger={trigger} />
    )

    const triggerButton = screen.getByText('Menu')
    await user.click(triggerButton)

    const item = screen.getByText('Option 1')
    await user.click(item)

    await waitFor(() => {
      const menu = container.querySelector('[class*="absolute"]')
      expect(menu).toBeFalsy()
    })
  })

  it('renders all items', async () => {
    const user = userEvent.setup()
    render(<Dropdown items={mockItems} trigger={trigger} />)
    await user.click(screen.getByText('Menu'))

    expect(await screen.findByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('applies variant classes to items', async () => {
    const user = userEvent.setup()
    render(<Dropdown items={mockItems} trigger={trigger} />)
    await user.click(screen.getByText('Menu'))

    const dangerItem = await screen.findByText('Delete')
    expect(dangerItem).toHaveClass('text-red-600')
    expect(screen.getByText('Edit')).not.toHaveClass('text-red-600')
  })

  it('supports custom trigger element', () => {
    const customTrigger = <div className="custom-trigger">Open</div>
    render(<Dropdown items={mockItems} trigger={customTrigger} />)
    
    expect(screen.getByText('Open')).toBeTruthy()
  })

  it('closes menu when clicking outside', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <div>
        <div data-testid="outside">Outside element</div>
        <Dropdown items={mockItems} trigger={trigger} />
      </div>
    )

    const triggerButton = screen.getByText('Menu')
    await user.click(triggerButton)

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeTruthy()
    })

    const outside = screen.getByTestId('outside')
    await user.click(outside)

    await waitFor(() => {
      const menu = container.querySelector('[class*="absolute"]')
      expect(menu).toBeFalsy()
    }, { timeout: 500 })
  })
})
