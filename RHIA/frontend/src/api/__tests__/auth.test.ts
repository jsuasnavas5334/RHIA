import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../client', () => {
  const post = vi.fn()
  return {
    default: { post, defaults: { headers: { common: {} } } },
    setAuthToken: vi.fn(),
    clearAuthToken: vi.fn(),
    getAuthToken: vi.fn(() => null),
  }
})

import api, { setAuthToken } from '../client'
import { normalizeLoginResponse, loginRequest, getLoginErrorMessage } from '../auth'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'

const user = { id: 1, email: 'a@b.com', nombre_completo: 'Ana', rol: 'admin', activo: true }
const post = api.post as unknown as ReturnType<typeof vi.fn>

describe('auth API (contrato de login unificado)', () => {
  beforeEach(() => {
    post.mockReset()
    vi.mocked(setAuthToken).mockClear()
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
  })

  it('acepta access_token', () => {
    expect(normalizeLoginResponse({ access_token: 'abc', user }).token).toBe('abc')
  })

  it('acepta token', () => {
    expect(normalizeLoginResponse({ token: 'xyz', user }).token).toBe('xyz')
  })

  it('prioriza access_token si vienen ambos', () => {
    expect(normalizeLoginResponse({ access_token: 'a', token: 'b' }).token).toBe('a')
  })

  it('falla si no hay token', () => {
    expect(() => normalizeLoginResponse({ user })).toThrow(/token/)
    expect(() => normalizeLoginResponse(undefined)).toThrow()
  })

  it('loginRequest llama POST /auth/login', async () => {
    post.mockResolvedValue({ data: { access_token: 'tok', user } })
    const res = await loginRequest({ email: 'a@b.com', password: 'x' } as any)
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'x' })
    expect(res).toEqual({ token: 'tok', user, expiresIn: undefined })
  })

  it('getLoginErrorMessage usa detail, luego message, luego fallback', () => {
    expect(getLoginErrorMessage({ response: { data: { detail: 'D' } } }, 'F')).toBe('D')
    expect(getLoginErrorMessage({ message: 'M' }, 'F')).toBe('M')
    expect(getLoginErrorMessage({}, 'F')).toBe('F')
  })

  it('useAuth.login persiste token y usuario en el store', async () => {
    post.mockResolvedValue({ data: { access_token: 'tok2', user } })
    const { result } = renderHook(() => useAuth())
    let out: any
    await act(async () => {
      out = await result.current.login({ email: 'a@b.com', password: 'x' } as any)
    })
    expect(out).toEqual({ success: true, token: 'tok2' })
    expect(setAuthToken).toHaveBeenCalledWith('tok2')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(user)
  })

  it('useAuth.login reporta error sin tocar el store', async () => {
    post.mockRejectedValue({ response: { data: { detail: 'Credenciales inválidas' } } })
    const { result } = renderHook(() => useAuth())
    let out: any
    await act(async () => {
      out = await result.current.login({ email: 'a@b.com', password: 'bad' } as any)
    })
    expect(out).toEqual({ success: false, error: 'Credenciales inválidas' })
    expect(result.current.error).toBe('Credenciales inválidas')
    expect(setAuthToken).not.toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
