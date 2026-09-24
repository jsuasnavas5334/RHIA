import { afterEach, vi } from 'vitest'

// Mock para Blob API en tests
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock para localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

// Cleanup después de cada test
afterEach(() => {
  vi.clearAllMocks()
})
