import { Check } from 'lucide-react'

interface FormStepperProps {
  steps: string[]
  current: number
  completed: Set<number>
  onStepClick?: (step: number) => void
}

export default function FormStepper({ steps, current, completed, onStepClick }: FormStepperProps) {
  return (
    <div className="flex items-center gap-1 mb-6 px-2">
      {steps.map((label, i) => {
        const num = i + 1
        const done = completed.has(num)
        const active = current === num
        const canClick = done && onStepClick

        return (
          <div key={label} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onStepClick(num)}
              className={`flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3.5 text-xs font-medium transition-all ${
                done
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                  : active
                  ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                  : 'bg-gray-50 text-gray-400'
              } ${!canClick && !active ? 'cursor-default' : ''}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                done
                  ? 'bg-emerald-500 text-white'
                  : active
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {done ? <Check className="h-3.5 w-3.5" /> : num}
              </span>
              {label}
            </button>

            {i < steps.length - 1 && (
              <div className={`mx-2 h-px flex-1 transition-colors ${done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
