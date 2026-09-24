import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, StatCard } from '../Card'

describe('Card Component', () => {
  it('renders children content', () => {
    render(<Card>Test content</Card>)
    expect(screen.getByText('Test content')).toBeTruthy()
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>)
    const card = container.firstChild
    expect(card).toHaveClass('custom-class')
  })

  it('applies default card styles', () => {
    const { container } = render(<Card>Test</Card>)
    const card = container.firstChild
    expect(card).toHaveClass('bg-white', 'dark:bg-slate-900', 'rounded-lg')
  })
})

describe('StatCard Component', () => {
  it('renders title and value', () => {
    render(<StatCard title="Revenue" value="$50,000" icon="📈" />)
    expect(screen.getByText('Revenue')).toBeTruthy()
    expect(screen.getByText('$50,000')).toBeTruthy()
  })

  it('renders icon', () => {
    render(<StatCard title="Sales" value="120" icon="💰" />)
    expect(screen.getByText('💰')).toBeTruthy()
  })

  it('applies positive trend style', () => {
    const { container } = render(
      <StatCard title="Growth" value="25%" trend="up" />
    )
    const trendElement = container.querySelector('.text-green-500')
    expect(trendElement).toBeTruthy()
  })

  it('applies negative trend style', () => {
    const { container } = render(
      <StatCard title="Loss" value="10%" trend="down" />
    )
    const trendElement = container.querySelector('.text-red-500')
    expect(trendElement).toBeTruthy()
  })
})
