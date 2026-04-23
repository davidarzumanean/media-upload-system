interface ProgressBarProps {
  progress: number // 0–1
  className?: string
  color?: 'blue' | 'green' | 'yellow' | 'red'
}

const colorMap = {
  blue:   'bg-blue-500',
  green:  'bg-emerald-500',
  yellow: 'bg-amber-400',
  red:    'bg-red-400',
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
