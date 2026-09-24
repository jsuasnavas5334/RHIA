import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../Badge'

describe('Badge Component', () => {
  it('renders with text', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('applies variant styles for nuevo', () => {
    const { container } = render(<Badge variant="nuevo">Nuevo</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800')
  })

  it('applies variant styles for contactado', () => {
    const { container } = render(<Badge variant="contactado">Contactado</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800')
  })

  it('applies variant styles for respondio', () => {
    const { container } = render(<Badge variant="respondio">Respondió</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('bg-purple-100', 'text-purple-800')
  })

  it('applies variant styles for ganado', () => {
    const { container } = render(<Badge variant="ganado">Ganado</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('bg-green-100', 'text-green-800')
  })

  it('applies variant styles for perdido', () => {
    const { container } = render(<Badge variant="perdido">Perdido</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('bg-red-100', 'text-red-800')
  })

  it('applies custom size', () => {
    const { container } = render(<Badge size="lg">Large</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('px-4', 'py-2')
  })

  it('applies small size', () => {
    const { container } = render(<Badge size="sm">Small</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('px-2', 'py-0.5')
  })
})
