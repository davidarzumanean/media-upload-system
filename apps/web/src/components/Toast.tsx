import { useToastState } from '../context/ToastContext'
import { ErrorIcon } from './icons/ErrorIcon'

export function Toast() {
  const { toasts, removeToast } = useToastState()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-9999 flex flex-col gap-2 max-w-90 w-[calc(100vw-40px)]"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className="animate-toast-in flex items-start gap-2.5 bg-error-light border border-red-200 rounded-xl px-3.5 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.08)] text-red-600"
        >
          <span className="shrink-0 mt-0.5">
            <ErrorIcon />
          </span>
          <span className="flex-1 text-[13px] leading-4.5 wrap-break-word">
            {toast.message}
          </span>
          <button
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss"
            className="shrink-0 flex items-center justify-center w-5 h-5 text-red-400 hover:text-red-500 transition-colors cursor-pointer border-0 bg-transparent p-0 rounded"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
