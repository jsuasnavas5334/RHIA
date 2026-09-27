import React from 'react'
import { LeadStatus } from '../../types'

interface BadgeProps {
  status: LeadStatus | string
  className?: string
}

const statusColorMap: Record<string, { bg: string; text: string }> = {
  nuevo: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
  contactado: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
  respondio: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200' },
  ganado: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
  perdido: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' },
  // Estados de reglas de automatización
  activa: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
  inactiva: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
}

const statusLabelMap: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  respondio: 'Respondió',
  ganado: 'Ganado',
  perdido: 'Perdido',
  activa: 'Activa',
  inactiva: 'Inactiva',
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const colors = statusColorMap[status] || statusColorMap.nuevo
  const label = statusLabelMap[status] || status

  return (
    <span
      className={`
        inline-flex items-center px-3 py-1
        rounded-full text-sm font-medium
        ${colors.bg} ${colors.text}
        ${className}
      `}
    >
      {label}
    </span>
  )
}

// Loader vive ahora en ./Loader; se re-exporta para no romper imports existentes
export { Loader } from './Loader'
