interface ProgressBarProps {
  progress: number // 0–1
  className?: string
  color?: 'blue' | 'green' | 'yellow' | 'red'
}

const colorMap = {
  blue:   'bg-blue-500',    // primary      #3B82F6
  green:  'bg-emerald-500', // success      #10B981
  yellow: 'bg-amber-500',   // warning      #F59E0B  (was amber-400 = #FBBF24)
  red:    'bg-red-500',     // error        #EF4444  (was red-400   = #F87171)
}

export function ProgressBar({ progress, className = '', color = 'blue' }: ProgressBarProps) {
  const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100)
  return (
    <div
      className={`h-1.5 w-full rounded-full bg-gray-100 overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% complete`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${colorMap[color]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
