import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose?: () => void
  onCancel?: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  confirmLabel?: string
  cancelText?: string
  cancelLabel?: string
  type?: 'danger' | 'warning' | 'info'
  variant?: 'danger' | 'warning' | 'info'
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  type,
  variant
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const handleClose = onClose || onCancel || (() => {})
  const displayType = type || variant || 'warning'
  const displayConfirmText = confirmText || confirmLabel || 'Confirmer'
  const displayCancelText = cancelText || cancelLabel || 'Annuler'

  const typeColors = {
    danger: 'bg-red-100 text-red-600',
    warning: 'bg-yellow-100 text-yellow-600',
    info: 'bg-blue-100 text-blue-600'
  }

  const buttonColors = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-blue-600 hover:bg-blue-700'
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />

        {/* Dialog */}
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md z-50">
          <div className="p-6">
            {/* Icon */}
            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${typeColors[displayType]} mb-4`}>
              <AlertTriangle className="h-6 w-6" />
            </div>

            {/* Title and Message */}
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500">{message}</p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                {displayCancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm()
                  handleClose()
                }}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors ${buttonColors[displayType]}`}
              >
                {displayConfirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
