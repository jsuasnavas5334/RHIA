import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Card, { StatCard } from '../Card'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders card with children', () => {
      render(<Card>Card Content</Card>)
      expect(screen.getByText('Card Content')).toBeInTheDocument()
    })

    it('renders with title', () => {
      render(<Card title="Test Title">Content</Card>)
      expect(screen.getByText('Test Title')).toBeInTheDocument()
    })

    it('renders with subtitle', () => {
      render(<Card subtitle="Test Subtitle">Content</Card>)
      expect(screen.getByText('Test Subtitle')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<Card className="custom-class">Content</Card>)
      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('StatCard', () => {
    it('renders with label and value', () => {
      render(<StatCard label="Revenue" value="$10,000" />)
      expect(screen.getByText('Revenue')).toBeInTheDocument()
      expect(screen.getByText('$10,000')).toBeInTheDocument()
    })

    it('renders with upward trend', () => {
      render(<StatCard label="Growth" value="25%" trend="up" trendValue="+5%" />)
      expect(screen.getByText('Growth')).toBeInTheDocument()
      expect(screen.getByText('25%')).toBeInTheDocument()
    })

    it('renders with downward trend', () => {
      render(<StatCard label="Loss" value="10%" trend="down" trendValue="-2%" />)
      expect(screen.getByText('Loss')).toBeInTheDocument()
      expect(screen.getByText('10%')).toBeInTheDocument()
    })

    it('renders with icon', () => {
      const { container } = render(<StatCard label="Users" value="100" icon={<span>👤</span>} />)
      expect(container).toBeInTheDocument()
    })
  })
})
