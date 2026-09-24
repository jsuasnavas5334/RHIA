import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton, SkeletonText, SkeletonTable } from '../Skeleton'

describe('Skeleton Component', () => {
  it('renders skeleton loader', () => {
    const { container } = render(<Skeleton />)
    const skeleton = container.querySelector('[class*="animate-pulse"]')
    expect(skeleton).toBeTruthy()
  })

  it('applies custom width', () => {
    const { container } = render(<Skeleton width="100px" />)
    const skeleton = container.querySelector('[class*="animate-pulse"]')
    expect(skeleton).toHaveStyle('width: 100px')
  })

  it('applies custom height', () => {
    const { container } = render(<Skeleton height="50px" />)
    const skeleton = container.querySelector('[class*="animate-pulse"]')
    expect(skeleton).toHaveStyle('height: 50px')
  })

  it('applies rounded styling', () => {
    const { container } = render(<Skeleton rounded={true} />)
    const skeleton = container.querySelector('[class*="animate-pulse"]')
    expect(skeleton).toHaveClass('rounded-full')
  })
})

describe('SkeletonText Component', () => {
  it('renders multiple skeleton lines', () => {
    const { container } = render(<SkeletonText lines={3} />)
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  it('renders default 2 lines when not specified', () => {
    const { container } = render(<SkeletonText />)
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })

  it('applies gap between lines', () => {
    const { container } = render(<SkeletonText lines={2} />)
    const wrapper = container.firstChild
    expect(wrapper).toHaveClass('space-y-2')
  })
})

describe('SkeletonTable Component', () => {
  it('renders skeleton table structure', () => {
    const { container } = render(
      <SkeletonTable rows={5} columns={4} />
    )
    const table = container.querySelector('table')
    expect(table).toBeTruthy()
  })

  it('renders correct number of header columns', () => {
    const { container } = render(
      <SkeletonTable rows={3} columns={4} />
    )
    const headerCells = container.querySelectorAll('thead th')
    expect(headerCells.length).toBe(4)
  })

  it('renders correct number of body rows', () => {
    const { container } = render(
      <SkeletonTable rows={5} columns={3} />
    )
    const bodyRows = container.querySelectorAll('tbody tr')
    expect(bodyRows.length).toBe(5)
  })

  it('renders correct number of cells per row', () => {
    const { container } = render(
      <SkeletonTable rows={3} columns={4} />
    )
    const firstRow = container.querySelector('tbody tr')
    const cells = firstRow?.querySelectorAll('td')
    expect(cells?.length).toBe(4)
  })

  it('contains skeleton loaders in cells', () => {
    const { container } = render(
      <SkeletonTable rows={2} columns={2} />
    )
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
