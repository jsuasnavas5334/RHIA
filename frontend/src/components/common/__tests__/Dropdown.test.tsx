import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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

    expect(screen.getByText('Edit')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
  })

  it('hides menu when trigger is clicked again', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Dropdown items={mockItems} trigger={trigger} />
    )

    const triggerButton = screen.getByText('Menu')
    await user.click(triggerButton)
    expect(screen.getByText('Edit')).toBeTruthy()

    await user.click(triggerButton)
    const menu = container.querySelector('[class*="absolute"]')
    expect(menu).toBeFalsy()
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

    const menuItem = screen.getByText('Click me')
    await user.click(menuItem)

    expect(handleClick).toHaveBeenCalled()
  })

  it('closes menu after item is clicked', async () => {
    const user = userEvent.setup()
    render(<Dropdown items={mockItems} trigger={trigger} />)

    const triggerButton = screen.getByText('Menu')
    await user.click(triggerButton)

    const menuItem = screen.getByText('Edit')
    await user.click(menuItem)

    // Menu should be closed now
    await user.click(triggerButton)
    const menuItems = screen.getAllByText('Edit')
    expect(menuItems.length).toBe(1) // Only one Edit visible after reopening
  })

  it('applies danger variant styling', async () => {
    const user = userEvent.setup()
    render(<Dropdown items={mockItems} trigger={trigger} />)

    const triggerButton = screen.getByText('Menu')
    await user.click(triggerButton)

    const deleteButton = screen.getByText('Delete').closest('button')
    expect(deleteButton).toHaveClass('text-red-600')
  })

  it('aligns menu to right when specified', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Dropdown items={mockItems} trigger={trigger} align="right" />
    )

    const triggerButton = screen.getByText('Menu')
    await user.click(triggerButton)

    const menu = container.querySelector('[class*="right-0"]')
    expect(menu).toBeTruthy()
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
    expect(screen.getByText('Edit')).toBeTruthy()

    const outside = screen.getByTestId('outside')
    await user.click(outside)

    // Menu should be closed
    const menu = container.querySelector('[class*="absolute"]')
    expect(menu?.style.display).not.toBe('block')
  })

  it('renders multiple items', async () => {
    const user = userEvent.setup()
    const manyItems: DropdownItem[] = [
      { id: '1', label: 'Item 1' },
      { id: '2', label: 'Item 2' },
      { id: '3', label: 'Item 3' },
      { id: '4', label: 'Item 4' },
    ]

    render(<Dropdown items={manyItems} trigger={trigger} />)

    const triggerButton = screen.getByText('Menu')
    await user.click(triggerButton)

    expect(screen.getByText('Item 1')).toBeTruthy()
    expect(screen.getByText('Item 2')).toBeTruthy()
    expect(screen.getByText('Item 3')).toBeTruthy()
    expect(screen.getByText('Item 4')).toBeTruthy()
  })
})
