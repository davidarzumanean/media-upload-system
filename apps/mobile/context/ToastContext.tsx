import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export interface ToastItem {
  id: string
  message: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  addToast: (message: string) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_TOASTS = 3
const AUTO_DISMISS_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const removeToast = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => {
      const next = [...prev, { id, message }]
      if (next.length > MAX_TOASTS) {
        const dropped = next.splice(0, next.length - MAX_TOASTS)
        for (const t of dropped) {
          const timer = timers.current.get(t.id)
          if (timer) { clearTimeout(timer); timers.current.delete(t.id) }
        }
      }
      return next
    })
    const timer = setTimeout(() => removeToast(id), AUTO_DISMISS_MS)
    timers.current.set(id, timer)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast(): { addToast: (message: string) => void } {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return { addToast: ctx.addToast }
}

/** Internal hook — used only by the Toast component */
export function useToastState(): { toasts: ToastItem[]; removeToast: (id: string) => void } {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastState must be used inside ToastProvider')
  return { toasts: ctx.toasts, removeToast: ctx.removeToast }
}