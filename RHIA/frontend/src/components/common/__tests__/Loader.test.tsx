import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Loader } from '../Loader'

describe('Loader Component', () => {
  it('renders loader with default size', () => {
    const { container } = render(<Loader />)
    const loader = container.querySelector('.animate-spin')
    expect(loader).toBeTruthy()
  })

  it('applies small size class', () => {
    const { container } = render(<Loader size="sm" />)
    const loader = container.querySelector('div[class*="w-4"]')
    expect(loader).toBeTruthy()
  })

  it('applies medium size class', () => {
    const { container } = render(<Loader size="md" />)
    const loader = container.querySelector('div[class*="w-8"]')
    expect(loader).toBeTruthy()
  })

  it('applies large size class', () => {
    const { container } = render(<Loader size="lg" />)
    const loader = container.querySelector('div[class*="w-12"]')
    expect(loader).toBeTruthy()
  })

  it('renders spinner animation', () => {
    const { container } = render(<Loader />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg).toHaveClass('animate-spin')
  })

  it('applies fullscreen overlay when specified', () => {
    const { container } = render(<Loader fullscreen />)
    const overlay = container.querySelector('.fixed')
    expect(overlay).toBeTruthy()
    expect(overlay).toHaveClass('inset-0', 'flex', 'items-center', 'justify-center')
  })
})
