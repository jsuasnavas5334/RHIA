import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { MockInstance } from 'vitest'
import { App } from '../App'
import { useAuthStore } from '../store/authStore'

const routerFutureWarnings = (spy: MockInstance) =>
  spy.mock.calls.filter((args) => String(args[0]).includes('React Router Future Flag Warning'))

describe('App (smoke)', () => {
  // React Router avisa una sola vez por módulo (warnOnce): el spy se instala
  // antes de CADA render para no perder el aviso si lo emite el primer test.
  let warnSpy: MockInstance

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useAuthStore.getState().logout()
  })

  afterEach(() => {
    warnSpy.mockRestore()
    window.history.replaceState(null, '', '/')
  })

  it('sin sesión, "/" termina en /login y muestra el formulario', async () => {
    window.history.replaceState(null, '', '/')

    render(<App />)

    expect(await screen.findByPlaceholderText('tu@empresa.com')).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(routerFutureWarnings(warnSpy)).toEqual([])
  })

  it('sin sesión, una ruta protegida (/leads) también redirige a /login', async () => {
    window.history.replaceState(null, '', '/leads')

    render(<App />)

    expect(await screen.findByPlaceholderText('tu@empresa.com')).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(routerFutureWarnings(warnSpy)).toEqual([])
  })
})
