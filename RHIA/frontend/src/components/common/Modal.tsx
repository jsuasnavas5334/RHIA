import React, { useEffect } from 'react'
import { Button } from './Button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  onConfirm?: () => void
  confirmText?: string
  confirmVariant?: 'primary' | 'danger' | 'success'
  cancelText?: string
  size?: 'sm' | 'md' | 'lg'
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  onConfirm,
  confirmText = 'Confirmar',
  confirmVariant = 'primary',
  cancelText = 'Cancelar',
  size = 'md',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }[size]

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-lg shadow-lg ${sizeClass} max-h-[90vh] overflow-y-auto`}
      >
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">{children}</div>

        {/* Footer */}
        {onConfirm && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {cancelText}
            </Button>
            <Button variant={confirmVariant} onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  confirmVariant?: 'danger' | 'success' | 'primary'
  cancelText?: string
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  confirmVariant = 'danger',
  cancelText = 'Cancelar',
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      onConfirm={onConfirm}
      confirmText={confirmText}
      confirmVariant={confirmVariant}
      cancelText={cancelText}
      size="sm"
    >
      <p className="text-gray-700 dark:text-gray-300">{message}</p>
    </Modal>
  )
}
