import { describe, it, expect, vi } from 'vitest'
import { exportToCSV, parseCSV, generateCSVContent } from '../csv'

describe('CSV Utilities', () => {
  describe('exportToCSV', () => {
    it('exports array of objects to CSV string by default', () => {
      const data = [
        { id: '1', name: 'John', email: 'john@example.com' },
        { id: '2', name: 'Jane', email: 'jane@example.com' },
      ]

      const csv = exportToCSV(data)

      expect(typeof csv).toBe('string')
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

      const csv = exportToCSV(data) as string

      expect(csv).toContain('"John ""Johnny"" Doe"')
    })

    it('handles commas in values', () => {
      const data = [
        { id: '1', name: 'Doe, John', email: 'john@example.com' },
      ]

      const csv = exportToCSV(data) as string

      expect(csv).toContain('"Doe, John"')
    })

    it('handles newlines in values', () => {
      const data = [
        { id: '1', name: 'John Doe', description: 'Line 1\nLine 2' },
      ]

      const csv = exportToCSV(data) as string

      expect(csv).toContain('"Line 1\nLine 2"')
    })

    it('creates downloadable blob when returnBlob is true', () => {
      const data = [{ id: '1', name: 'John' }]

      const blob = exportToCSV(data, true)

      expect(blob).toBeInstanceOf(Blob)
      if (blob instanceof Blob) {
        expect(blob.type).toBe('text/csv;charset=utf-8;')
      }
    })
  })

  describe('generateCSVContent', () => {
    it('generates proper CSV format', () => {
      const data = [
        { id: '1', name: 'John', email: 'john@example.com' },
      ]

      const csv = generateCSVContent(data)

      expect(csv).toContain('id,name,email')
      expect(csv).toContain('1,John,john@example.com')
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

    it('returns empty array for empty string', () => {
      const result = parseCSV('')

      expect(result).toEqual([])
    })

    it('returns empty array for whitespace only', () => {
      const result = parseCSV('   \n  \n  ')

      expect(result).toEqual([])
    })

    it('handles quoted values with commas', () => {
      const csv = 'id,name,email\n1,"Doe, John",john@example.com'

      const result = parseCSV(csv)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Doe, John')
    })

    it('handles escaped quotes', () => {
      const csv = 'id,name,email\n1,"John ""Johnny"" Doe",john@example.com'

      const result = parseCSV(csv)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('John "Johnny" Doe')
    })

    it('handles multiline values', () => {
      const csv = 'id,description\n1,"Line 1\nLine 2\nLine 3"'

      const result = parseCSV(csv)

      expect(result).toHaveLength(1)
      expect(result[0].description).toContain('Line 1')
      expect(result[0].description).toContain('Line 2')
    })

    it('validates required columns', () => {
      const csv = 'id,name\n1,John'

      expect(() => parseCSV(csv, ['id', 'email'])).toThrow('Missing required columns')
    })

    it('passes required columns validation', () => {
      const csv = 'id,name,email\n1,John,john@example.com'

      const result = parseCSV(csv, ['id', 'name'])

      expect(result).toHaveLength(1)
    })

    it('handles mixed quoted and unquoted values', () => {
      const csv = 'id,name,email\n1,John,john@example.com\n2,"Doe, John",jane@example.com'

      const result = parseCSV(csv)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('John')
      expect(result[1].name).toBe('Doe, John')
    })
  })
})
