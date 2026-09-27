import React from 'react'

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  /** Muestra el checkbox en estado de error (borde rojo) */
  error?: boolean
  /** Clases extra para el <input>; `className` se aplica al contenedor */
  inputClassName?: string
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error = false, className = '', inputClassName = '', ...props }, ref) => {
    return (
      <label className={`flex items-center gap-2 cursor-pointer ${className}`.trim()}>
        <input
          ref={ref}
          type="checkbox"
          aria-invalid={error || undefined}
          className={`w-4 h-4 rounded ${
            error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
          } text-blue-600 cursor-pointer ${inputClassName}`.trim()}
          {...props}
        />
        {label && (
          <span
            className={`text-sm font-medium ${
              error ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {label}
          </span>
        )}
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export default Checkbox
