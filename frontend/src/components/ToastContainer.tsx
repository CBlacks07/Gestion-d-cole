import { useEffect, useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const bgStyles = {
  success: 'bg-white dark:bg-gray-800 border-l-4 border-emerald-500',
  error: 'bg-white dark:bg-gray-800 border-l-4 border-red-500',
  warning: 'bg-white dark:bg-gray-800 border-l-4 border-amber-400',
  info: 'bg-white dark:bg-gray-800 border-l-4 border-blue-500',
}

const iconBg = {
  success: 'bg-emerald-50 dark:bg-emerald-900/30',
  error: 'bg-red-50 dark:bg-red-900/30',
  warning: 'bg-amber-50 dark:bg-amber-900/30',
  info: 'bg-blue-50 dark:bg-blue-900/30',
}

const iconColor = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

const progressColor = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-400',
  info: 'bg-blue-500',
}

function ToastItem({ id, type, message, onDismiss }: { id: string; type: keyof typeof icons; message: string; onDismiss: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false)
  const Icon = icons[type]
  const DURATION = 4000

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), DURATION - 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`relative flex items-start gap-3 rounded-xl shadow-lg ring-1 ring-black/5 px-4 py-3 overflow-hidden transition-all duration-300 ${bgStyles[type]} ${
        leaving ? 'opacity-0 translate-x-4' : 'animate-slide-in'
      }`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg[type]}`}>
        <Icon className={`h-4.5 w-4.5 ${iconColor[type]} ${type === 'success' ? 'animate-bounce-once' : ''}`} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{message}</p>
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100 dark:bg-gray-700">
        <div
          className={`h-full ${progressColor[type]} rounded-full`}
          style={{ animation: `shrink-width ${DURATION}ms linear forwards` }}
        />
      </div>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 w-80 max-w-[calc(100vw-2.5rem)]">
      {toasts.map(toast => (
        <ToastItem key={toast.id} {...toast} onDismiss={dismiss} />
      ))}
    </div>
  )
}
