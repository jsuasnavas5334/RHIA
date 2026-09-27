import { afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { getConfig as getRtlDomConfig } from '@testing-library/react'
import { configure as configureUserEventDom } from '@testing-library/dom'

// user-event usa @testing-library/dom@10 (top-level) mientras que
// @testing-library/react@14 configura su propia copia anidada (dom@9)
// con act(). Compartimos los wrappers de RTL para que los eventos de
// user-event queden envueltos en act() y no aparezcan warnings.
{
  const rtl = getRtlDomConfig()
  configureUserEventDom({
    asyncWrapper: rtl.asyncWrapper,
    eventWrapper: rtl.eventWrapper,
    unstable_advanceTimersWrapper: rtl.unstable_advanceTimersWrapper,
  })
}

// Mock para Blob API
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock simple para localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

// Cleanup
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
