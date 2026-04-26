import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast, useToastState } from '../ToastContext'

// ── Helper components ─────────────────────────────────────────────────────────

function MultiToastConsumer() {
  const { addToast } = useToast()
  return (
    <>
      <button onClick={() => addToast('msg-1')}>add1</button>
      <button onClick={() => addToast('msg-2')}>add2</button>
      <button onClick={() => addToast('msg-3')}>add3</button>
      <button onClick={() => addToast('msg-4')}>add4</button>
    </>
  )
}

function ToastList() {
  const { toasts, removeToast } = useToastState()
  return (
    <ul>
      {toasts.map((t) => (
        <li key={t.id}>
          {t.message}
          <button onClick={() => removeToast(t.id)}>dismiss-{t.message}</button>
        </li>
      ))}
    </ul>
  )
}

function renderFull() {
  return render(
    <ToastProvider>
      <MultiToastConsumer />
      <ToastList />
    </ToastProvider>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ToastContext', () => {
  it('addToast renders a toast message', () => {
    renderFull()
    fireEvent.click(screen.getByRole('button', { name: 'add1' }))
    expect(screen.getByText('msg-1')).toBeInTheDocument()
  })

  it('auto-dismisses after 5000 ms', () => {
    vi.useFakeTimers()
    try {
      renderFull()
      fireEvent.click(screen.getByRole('button', { name: 'add1' }))
      expect(screen.getByText('msg-1')).toBeInTheDocument()

      act(() => { vi.advanceTimersByTime(5000) })

      expect(screen.queryByText('msg-1')).not.toBeInTheDocument()
    } finally {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
    }
  })

  it('removeToast dismisses immediately and cancels the auto-dismiss timer', () => {
    vi.useFakeTimers()
    try {
      renderFull()
      fireEvent.click(screen.getByRole('button', { name: 'add1' }))
      fireEvent.click(screen.getByRole('button', { name: 'dismiss-msg-1' }))
      expect(screen.queryByText('msg-1')).not.toBeInTheDocument()

      // Timer must not fire a second time after manual removal
      act(() => { vi.advanceTimersByTime(5000) })
      expect(screen.queryByText('msg-1')).not.toBeInTheDocument()
    } finally {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
    }
  })

  it('caps at MAX_TOASTS=3 and drops the oldest when a 4th is added', () => {
    vi.useFakeTimers()
    try {
      renderFull()
      fireEvent.click(screen.getByRole('button', { name: 'add1' }))
      fireEvent.click(screen.getByRole('button', { name: 'add2' }))
      fireEvent.click(screen.getByRole('button', { name: 'add3' }))
      fireEvent.click(screen.getByRole('button', { name: 'add4' }))

      expect(screen.queryByText('msg-1')).not.toBeInTheDocument()
      expect(screen.getByText('msg-2')).toBeInTheDocument()
      expect(screen.getByText('msg-3')).toBeInTheDocument()
      expect(screen.getByText('msg-4')).toBeInTheDocument()
    } finally {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
    }
  })

  it('useToast throws when used outside ToastProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    function BadComponent() {
      useToast()
      return null
    }
    expect(() => render(<BadComponent />)).toThrow(
      'useToast must be used inside ToastProvider',
    )
    consoleError.mockRestore()
  })

  it('useToastState throws when used outside ToastProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    function BadComponent() {
      useToastState()
      return null
    }
    expect(() => render(<BadComponent />)).toThrow(
      'useToastState must be used inside ToastProvider',
    )
    consoleError.mockRestore()
  })
})