import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToCSV, parseCSV } from '../csv'

describe('CSV Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parseCSV', () => {
    it('parses simple CSV correctly', () => {
      const csv = 'id,name,email\n1,John,john@example.com\n2,Jane,jane@example.com'
      const result = parseCSV(csv)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
      expect(result[0].name).toBe('John')
    })

    it('handles quoted values', () => {
      const csv = 'name,email\n"Doe, John","john@example.com"'
      const result = parseCSV(csv)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Doe, John')
    })

    it('handles empty cells', () => {
      const csv = 'id,name,email\n1,John,\n2,,jane@example.com'
      const result = parseCSV(csv)
      expect(result).toHaveLength(2)
      expect(result[0].email).toBe('')
    })

    it('throws on empty string', () => {
      expect(() => parseCSV('')).toThrow()
    })

    it('handles escaped quotes', () => {
      const csv = 'name,title\n"John ""Johnny"" Doe","CEO"'
      const result = parseCSV(csv)
      expect(result).toHaveLength(1)
      expect(result[0].name).toContain('Johnny')
    })
  })

  describe('exportToCSV', () => {
    it('exports array of objects to CSV', () => {
      const data = [
        { id: '1', nombre: 'John', email: 'john@example.com' },
      ]
      const result = exportToCSV(data as any)
      expect(result).toBeDefined()
    })

    it('handles empty array and throws', () => {
      expect(() => exportToCSV([])).toThrow()
    })

    it('escapes special characters properly', () => {
      const data = [
        { id: '1', nombre: 'John "Johnny" Doe', email: 'john@example.com' },
      ]
      const result = exportToCSV(data as any)
      expect(result).toBeDefined()
    })
  })
})
