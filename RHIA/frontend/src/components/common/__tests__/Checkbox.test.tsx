import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from '../Checkbox'

describe('Checkbox Component', () => {
  it('renders checkbox input', () => {
    const { container } = render(<Checkbox label="Accept" />)
    const checkbox = container.querySelector('input[type="checkbox"]')
    expect(checkbox).toBeTruthy()
  })

  it('renders with label', () => {
    render(<Checkbox label="I agree" />)
    expect(screen.getByText('I agree')).toBeTruthy()
  })

  it('handles checked state', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    const { container } = render(
      <Checkbox label="Check me" onChange={handleChange} />
    )

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    await user.click(checkbox)

    expect(handleChange).toHaveBeenCalled()
  })

  it('renders as checked when checked prop is true', () => {
    const { container } = render(<Checkbox label="Checked" checked={true} onChange={() => {}} />)
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('renders as unchecked when checked prop is false', () => {
    const { container } = render(<Checkbox label="Unchecked" checked={false} onChange={() => {}} />)
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it('disables checkbox when disabled prop is true', () => {
    const { container } = render(<Checkbox label="Disabled" disabled={true} />)
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox.disabled).toBe(true)
  })

  it('applies custom className', () => {
    const { container } = render(
      <Checkbox label="Custom" className="custom-class" />
    )
    const wrapper = container.firstChild
    expect(wrapper).toHaveClass('custom-class')
  })

  it('applies error styling when error is true', () => {
    const { container } = render(
      <Checkbox label="Error" error={true} />
    )
    const checkbox = container.querySelector('input[type="checkbox"]')
    expect(checkbox).toHaveClass('border-red-500')
  })
})
