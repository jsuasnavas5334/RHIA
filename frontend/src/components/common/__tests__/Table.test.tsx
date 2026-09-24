import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table, Column } from '../Table'

describe('Table Component', () => {
  const mockData = [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  ]

  const columns: Column<typeof mockData[0]>[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
  ]

  it('renders table headers', () => {
    render(<Table data={mockData} columns={columns} />)
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Email')).toBeTruthy()
  })

  it('renders table data', () => {
    render(<Table data={mockData} columns={columns} />)
    expect(screen.getByText('John Doe')).toBeTruthy()
    expect(screen.getByText('jane@example.com')).toBeTruthy()
  })

  it('renders correct number of rows', () => {
    const { container } = render(<Table data={mockData} columns={columns} />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(mockData.length)
  })

  it('handles row click', async () => {
    const user = userEvent.setup()
    const handleRowClick = vi.fn()
    render(
      <Table
        data={mockData}
        columns={columns}
        onRowClick={handleRowClick}
      />
    )

    const firstRow = screen.getByText('John Doe').closest('tr')
    await user.click(firstRow!)
    expect(handleRowClick).toHaveBeenCalledWith(mockData[0])
  })

  it('renders custom render functions', () => {
    const customColumns: Column<typeof mockData[0]>[] = [
      {
        key: 'name',
        label: 'Name',
        render: (value) => `Mr/Ms ${value}`,
      },
      { key: 'email', label: 'Email' },
    ]

    render(<Table data={mockData} columns={customColumns} />)
    expect(screen.getByText('Mr/Ms John Doe')).toBeTruthy()
  })

  it('handles empty data', () => {
    const { container } = render(
      <Table data={[]} columns={columns} emptyMessage="No data" />
    )
    expect(screen.getByText('No data')).toBeTruthy()
  })

  it('applies striped styling', () => {
    const { container } = render(
      <Table data={mockData} columns={columns} striped={true} />
    )
    const rows = container.querySelectorAll('tbody tr')
    const secondRow = rows[1]
    expect(secondRow).toHaveClass('bg-gray-50')
  })

  it('applies hover styling', () => {
    const { container } = render(
      <Table data={mockData} columns={columns} hover={true} />
    )
    const rows = container.querySelectorAll('tbody tr')
    expect(rows[0]).toHaveClass('hover:bg-gray-100')
  })
})
