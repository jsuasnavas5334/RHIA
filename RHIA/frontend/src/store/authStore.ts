import { create } from 'zustand'
import { User } from '../types'
import { getAuthToken, setAuthToken, clearAuthToken } from '../api/client'

export const USER_KEY = 'rhia_user'

const saveUser = (user: User | null) => {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {
    /* almacenamiento no disponible: se mantiene solo en memoria */
  }
}

const loadUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void
  initFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setUser: (user) => {
    saveUser(user)
    set({
      user,
      isAuthenticated: !!user,
    })
  },

  // Persiste el token para que el interceptor de axios lo envíe
  // y para que la sesión sobreviva a una recarga.
  setToken: (token) => {
    if (token) setAuthToken(token)
    else clearAuthToken()
    set({
      token,
      isAuthenticated: !!token,
    })
  },

  logout: () => {
    clearAuthToken()
    saveUser(null)
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    })
  },

  initFromStorage: () => {
    const token = getAuthToken()
    if (token) {
      set({
        token,
        user: loadUser(),
        isAuthenticated: true,
      })
    }
  },
}))
