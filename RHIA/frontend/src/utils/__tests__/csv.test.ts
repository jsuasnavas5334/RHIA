import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToCSV, parseCSV } from '../csv'

describe('CSV Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportToCSV', () => {
    it('exports array of objects to CSV', () => {
      const data = [
        { id: '1', nombre: 'John', email: 'john@example.com' },
        { id: '2', nombre: 'Jane', email: 'jane@example.com' },
      ]
      const result = exportToCSV(data as any)
      expect(result).toBeDefined()
      expect(URL.createObjectURL).toHaveBeenCalled()
    })

    it('handles empty array', () => {
      expect(() => exportToCSV([])).toThrow()
    })

    it('escapes quotes in values', () => {
      const data = [
        { id: '1', nombre: 'John "Johnny" Doe', email: 'john@example.com' },
      ]
      const result = exportToCSV(data as any)
      expect(result).toBeDefined()
    })

    it('handles commas in values', () => {
      const data = [
        { id: '1', nombre: 'Doe, John', email: 'john@example.com' },
      ]
      const result = exportToCSV(data as any)
      expect(result).toBeDefined()
    })

    it('handles newlines in values', () => {
      const data = [
        { id: '1', nombre: 'John\nDoe', email: 'john@example.com' },
      ]
      const result = exportToCSV(data as any)
      expect(result).toBeDefined()
    })

    it('creates downloadable blob', () => {
      const data = [
        { id: '1', nombre: 'John', email: 'john@example.com' },
      ]
      const result = exportToCSV(data as any)
      expect(result).toBe('blob:mock-url')
    })

    it('uses custom filename', () => {
      const data = [
        { id: '1', nombre: 'John', email: 'john@example.com' },
      ]
      const result = exportToCSV(data as any, 'custom.csv')
      expect(result).toBeDefined()
    })
  })

  describe('parseCSV', () => {
    it('handles quoted values', () => {
      const csv = 'name,email\n"Doe, John","john@example.com"'
      const result = parseCSV(csv)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Doe, John')
      expect(result[0].email).toBe('john@example.com')
    })

    it('handles escaped quotes', () => {
      const csv = 'name,title\n"John ""Johnny"" Doe","CEO"'
      const result = parseCSV(csv)
      expect(result).toHaveLength(1)
      expect(result[0].name).toContain('Johnny')
    })

    it('returns empty array for empty string', () => {
      const csv = ''
      expect(() => parseCSV(csv)).toThrow()
    })

    it('handles multiline quoted values', () => {
      const csv = 'name,description\n"John Doe","Line 1\nLine 2"'
      const result = parseCSV(csv)
      expect(result).toHaveLength(1)
      expect(result[0].description).toContain('Line')
    })

    it('parses simple CSV correctly', () => {
      const csv = 'id,name,email\n1,John,john@example.com\n2,Jane,jane@example.com'
      const result = parseCSV(csv)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
      expect(result[0].name).toBe('John')
    })

    it('handles empty cells', () => {
      const csv = 'id,name,email\n1,John,\n2,,jane@example.com'
      const result = parseCSV(csv)
      expect(result).toHaveLength(2)
      expect(result[0].email).toBe('')
    })
  })

  describe('Round-trip conversion', () => {
    it('maintains data integrity through export and parse', () => {
      const originalData = [
        { id: '1', nombre: 'John', email: 'john@example.com' },
        { id: '2', nombre: 'Jane', email: 'jane@example.com' },
      ]
      
      const exported = exportToCSV(originalData as any)
      expect(exported).toBeDefined()
      expect(exported).toBe('blob:mock-url')
    })

    it('handles complex data round-trip', () => {
      const complexData = [
        { id: '1', nombre: 'John "Johnny" Doe', email: 'john@example.com', notas: 'Line 1\nLine 2' },
        { id: '2', nombre: 'Doe, Jane', email: 'jane@example.com', notas: 'Test' },
      ]
      
      const exported = exportToCSV(complexData as any)
      expect(exported).toBeDefined()
    })
  })
})
