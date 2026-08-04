import { Info } from 'lucide-react'

interface InfoTipProps {
  text: string
  className?: string
}

/**
 * Petite icône ⓘ avec tooltip au survol.
 * Usage : <InfoTip text="Explication courte" />
 */
export default function InfoTip({ text, className = '' }: InfoTipProps) {
  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-1.5 text-center text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  )
}
