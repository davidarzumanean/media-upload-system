import { useToastState } from '../context/ToastContext'

function ErrorIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

export function Toast() {
  const { toasts, removeToast } = useToastState()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-9999 flex flex-col gap-2 max-w-90 w-[calc(100vw-40px)]"
    >
      {toasts.map(toast => (
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
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}