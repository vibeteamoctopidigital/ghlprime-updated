import { createContext, useContext, useEffect, useRef } from 'react'

// Hooks and helpers shared by the Blog Writer screens. Kept apart from the
// components in ui.jsx so React Fast Refresh sees a file of components there
// and a file of plain functions here.

export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                     */
/* -------------------------------------------------------------------------- */

export const ToastContext = createContext(null)

export function useToast() {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside a ToastProvider')
  return api
}

/**
 * Poll a loader on a gap that depends on what came back: quick while a run is
 * in flight and the screen has something new to say every few seconds, slow
 * otherwise. Chained timeouts rather than an interval so the gap can change
 * without tearing the subscription down. Returns a manual reload.
 */
export function usePolling(load, { activeMs = 5000, idleMs = 20000 } = {}) {
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let cancelled = false
    let timer

    const tick = async (first) => {
      let active = false
      try {
        active = Boolean(await loadRef.current(!first))
      } catch {
        // The loader reports its own failures.
      } finally {
        if (!cancelled) timer = setTimeout(() => void tick(false), active ? activeMs : idleMs)
      }
    }

    void tick(true)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [activeMs, idleMs])
}
