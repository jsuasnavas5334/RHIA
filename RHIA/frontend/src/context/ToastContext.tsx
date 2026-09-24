import React, { createContext, useContext } from 'react'
import { useToast } from '../hooks/useToast'
import { ToastType } from '../components/common/Toast'

interface ToastContextType {
  success: (message: string, duration?: number) => string
  error: (message: string, duration?: number) => string
  info: (message: string, duration?: number) => string
  warning: (message: string, duration?: number) => string
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

interface ToastProviderProps {
  children: React.ReactNode
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const { success, error, info, warning } = useToast()

  const value: ToastContextType = {
    success,
    error,
    info,
    warning,
  }

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  )
}

export const useToastContext = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToastContext debe ser usado dentro de ToastProvider')
  }
  return context
}
