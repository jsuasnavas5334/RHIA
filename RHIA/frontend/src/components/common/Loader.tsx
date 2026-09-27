import React from 'react'

export interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  /** Texto bajo el spinner; pasar '' para ocultarlo */
  message?: string
  /** Muestra el loader como overlay a pantalla completa */
  fullscreen?: boolean
  className?: string
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
} as const

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  message = 'Cargando...',
  fullscreen = false,
  className = '',
}) => {
  const content = (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className={sizeMap[size]}>
        <svg
          className="animate-spin h-full w-full text-blue-600"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
      {message ? (
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      ) : (
        <span className="sr-only">Cargando...</span>
      )}
    </div>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80">
        {content}
      </div>
    )
  }

  return content
}

export default Loader
