'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { ToastContext, cn } from './hooks'

/**
 * A stack of short messages in the corner, the way octopi's screens report
 * "Added 4, 6 already queued." Success messages clear themselves; errors stay
 * until dismissed, because the thing they say is worth reading twice.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((toast) => toast.id !== id)), [])

  const push = useCallback(
    (tone, message) => {
      const id = (counter.current += 1)
      setToasts((prev) => [...prev, { id, tone, message }])
      if (tone !== 'error') setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="bw-toast-host" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={cn('bw-toast', `bw-toast-${toast.tone}`)}>
            <span>{toast.message}</span>
            <button type="button" className="bw-toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
