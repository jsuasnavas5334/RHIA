import { create } from 'zustand'
import { User } from '../types'
import { getAuthToken } from '../api/client'

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

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  setToken: (token) =>
    set({
      token,
      isAuthenticated: !!token,
    }),

  logout: () =>
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    }),

  initFromStorage: () => {
    const token = getAuthToken()
    if (token) {
      set({
        token,
        isAuthenticated: true,
      })
    }
  },
}))
