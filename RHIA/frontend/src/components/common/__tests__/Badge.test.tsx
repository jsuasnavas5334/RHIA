import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '../Badge'

describe('Badge Component', () => {
  it('renders with nuevo status', () => {
    render(<Badge status="nuevo" />)
    const badge = screen.getByText('Nuevo')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-blue-100')
  })

  it('renders with contactado status', () => {
    render(<Badge status="contactado" />)
    const badge = screen.getByText('Contactado')
    expect(badge).toHaveClass('bg-yellow-100')
  })

  it('renders with respondio status', () => {
    render(<Badge status="respondio" />)
    const badge = screen.getByText('Respondió')
    expect(badge).toHaveClass('bg-purple-100')
  })

  it('renders with ganado status', () => {
    render(<Badge status="ganado" />)
    const badge = screen.getByText('Ganado')
    expect(badge).toHaveClass('bg-green-100')
  })

  it('renders with perdido status', () => {
    render(<Badge status="perdido" />)
    const badge = screen.getByText('Perdido')
    expect(badge).toHaveClass('bg-red-100')
  })

  it('applies custom className', () => {
    const { container } = render(<Badge status="nuevo" className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
