import api from './client'
import { LoginRequest, User } from '../types'

/**
 * Forma cruda que puede devolver POST /auth/login.
 * El backend puede usar `access_token` (convención OAuth2/FastAPI)
 * o `token`; aceptamos ambas para que LoginPage y useAuth
 * compartan un único contrato.
 */
export interface RawLoginResponse {
  access_token?: string
  token?: string
  token_type?: string
  expires_in?: number
  user?: User | null
}

export interface LoginResult {
  token: string
  user: User | null
  expiresIn?: number
}

export const normalizeLoginResponse = (data: RawLoginResponse | null | undefined): LoginResult => {
  const token = data?.access_token ?? data?.token
  if (!token || typeof token !== 'string') {
    throw new Error('Respuesta de login inválida: no se recibió token')
  }
  return { token, user: data?.user ?? null, expiresIn: data?.expires_in }
}

export const loginRequest = async (credentials: LoginRequest): Promise<LoginResult> => {
  const response = await api.post<RawLoginResponse>('/auth/login', credentials)
  return normalizeLoginResponse(response.data)
}

export const getLoginErrorMessage = (err: any, fallback: string): string =>
  err?.response?.data?.detail || err?.message || fallback
