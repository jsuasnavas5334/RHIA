import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../Input'

describe('Input Component', () => {
  it('renders with label', () => {
    render(<Input label="Email" />)
    expect(screen.getByText('Email')).toBeTruthy()
  })

  it('shows error message', () => {
    render(<Input error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeTruthy()
  })

  it('shows helper text', () => {
    render(<Input helperText="Enter a valid email" />)
    expect(screen.getByText('Enter a valid email')).toBeTruthy()
  })

  it('marks required fields', () => {
    render(<Input label="Name" required />)
    const asterisk = screen.getByText('*')
    expect(asterisk).toHaveClass('text-red-500')
  })

  it('handles input changes', async () => {
    const user = userEvent.setup()
    const { container } = render(<Input placeholder="Type here" />)
    const input = container.querySelector('input') as HTMLInputElement

    await user.type(input, 'test value')
    expect(input.value).toBe('test value')
  })

  it('disables input when disabled prop is true', () => {
    const { container } = render(<Input disabled />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('applies error styling', () => {
    const { container } = render(<Input error="Error message" />)
    const input = container.querySelector('input')
    expect(input).toHaveClass('border-red-500')
  })
})
