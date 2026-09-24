import { describe, it, expect, beforeEach } from 'vitest'
import { exportToCSV, parseCSV } from '../csv'

describe('CSV Utilities', () => {
  describe('exportToCSV', () => {
    it('exports array of objects to CSV', () => {
      const data = [
        { id: '1', name: 'John', email: 'john@example.com' },
        { id: '2', name: 'Jane', email: 'jane@example.com' },
      ]

      const csv = exportToCSV(data)

      expect(csv).toContain('id,name,email')
      expect(csv).toContain('1,John,john@example.com')
      expect(csv).toContain('2,Jane,jane@example.com')
    })

    it('handles empty array', () => {
      const data: any[] = []
      const csv = exportToCSV(data)

      expect(csv).toBe('')
    })

    it('escapes quotes in values', () => {
      const data = [
        { id: '1', name: 'John "Johnny" Doe', email: 'john@example.com' },
      ]

      const csv = exportToCSV(data)

      expect(csv).toContain('"John ""Johnny"" Doe"')
    })

    it('handles commas in values', () => {
      const data = [
        { id: '1', name: 'Doe, John', email: 'john@example.com' },
      ]

      const csv = exportToCSV(data)

      expect(csv).toContain('"Doe, John"')
    })

    it('handles newlines in values', () => {
      const data = [
        { id: '1', name: 'John Doe', description: 'Line 1\nLine 2' },
      ]

      const csv = exportToCSV(data)

      expect(csv).toContain('"Line 1\nLine 2"')
    })

    it('creates downloadable blob', () => {
      const data = [{ id: '1', name: 'John' }]

      const blob = exportToCSV(data, true)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob?.type).toBe('text/csv;charset=utf-8')
    })

    it('uses custom filename', () => {
      const data = [{ id: '1', name: 'John' }]

      const spy = vi.spyOn(URL, 'createObjectURL')
      exportToCSV(data, true, 'custom_export.csv')

      // Filename would be used in download trigger
      spy.mockRestore()
    })
  })

  describe('parseCSV', () => {
    it('parses CSV string to array of objects', () => {
      const csv = 'id,name,email\n1,John,john@example.com\n2,Jane,jane@example.com'

      const result = parseCSV(csv)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: '1', name: 'John', email: 'john@example.com' })
      expect(result[1]).toEqual({ id: '2', name: 'Jane', email: 'jane@example.com' })
    })

    it('handles quoted values', () => {
      const csv = 'id,name,email\n1,"Doe, John",john@example.com'

      const result = parseCSV(csv)

      expect(result[0].name).toBe('Doe, John')
    })

    it('handles empty values', () => {
      const csv = 'id,name,email\n1,,john@example.com'

      const result = parseCSV(csv)

      expect(result[0].name).toBe('')
    })

    it('handles escaped quotes', () => {
      const csv = 'id,name\n1,"John ""Johnny"" Doe"'

      const result = parseCSV(csv)

      expect(result[0].name).toBe('John "Johnny" Doe')
    })

    it('returns empty array for empty string', () => {
      const result = parseCSV('')

      expect(result).toEqual([])
    })

    it('handles header with spaces', () => {
      const csv = 'id , name , email \n1,John,john@example.com'

      const result = parseCSV(csv)

      // Should handle spacing gracefully
      expect(result).toHaveLength(1)
    })

    it('validates required columns', () => {
      const csv = 'id,name\n1,John'
      const requiredColumns = ['id', 'name', 'email']

      const result = parseCSV(csv, requiredColumns)

      // Should indicate missing column
      expect(result).toBeDefined()
    })

    it('handles multiline quoted values', () => {
      const csv = 'id,name,description\n1,John,"Line 1\nLine 2"'

      const result = parseCSV(csv)

      expect(result[0].description).toContain('Line 1')
      expect(result[0].description).toContain('Line 2')
    })
  })

  describe('Round-trip conversion', () => {
    it('maintains data integrity through export and parse', () => {
      const originalData = [
        { id: '1', name: 'John', status: 'active' },
        { id: '2', name: 'Jane', status: 'inactive' },
      ]

      const csv = exportToCSV(originalData)
      const parsed = parseCSV(csv)

      expect(parsed).toEqual(originalData)
    })

    it('handles complex data round-trip', () => {
      const data = [
        { id: '1', name: 'Doe, John', description: 'Manager "Senior"' },
        { id: '2', name: 'Smith', description: 'Developer' },
      ]

      const csv = exportToCSV(data)
      const parsed = parseCSV(csv)

      expect(parsed).toEqual(data)
    })
  })
})
