'use client'

import { Loader2 } from 'lucide-react'
import { cn } from './hooks'

// The handful of primitives the two Blog Writer screens are built from, in
// the admin's own dark-glass style (see styles/blog-writer.css). Kept tiny on
// purpose: these mirror what octopi's screens took from shadcn — a card, a
// button, an input, a switch, a badge, a toast — and nothing more.

export function Card({ className, children }) {
  return <section className={cn('bw-card', className)}>{children}</section>
}

export function CardHeader({ className, children }) {
  return <div className={cn('bw-card-head', className)}>{children}</div>
}

export function CardContent({ className, children }) {
  return <div className={cn('bw-card-body', className)}>{children}</div>
}

export function CardFooter({ className, children }) {
  return <div className={cn('bw-card-foot', className)}>{children}</div>
}

/**
 * variant: primary | secondary | outline | ghost | icon
 * size: md | sm
 */
export function Button({ variant = 'secondary', size = 'md', busy = false, className, children, type = 'button', ...rest }) {
  return (
    <button type={type} className={cn('bw-btn', `bw-btn-${variant}`, size === 'sm' && 'bw-btn-sm', className)} {...rest}>
      {busy ? <Loader2 size={15} className="bw-spin" /> : null}
      {children}
    </button>
  )
}

export function Input({ className, ...rest }) {
  return <input className={cn('bw-input', className)} {...rest} />
}

export function Textarea({ className, ...rest }) {
  return <textarea className={cn('bw-input bw-textarea', className)} {...rest} />
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={cn('bw-input bw-select', className)} {...rest}>
      {children}
    </select>
  )
}

export function Label({ className, children, ...rest }) {
  return (
    <label className={cn('bw-label', className)} {...rest}>
      {children}
    </label>
  )
}

export function Hint({ className, children }) {
  return <p className={cn('bw-hint', className)}>{children}</p>
}

export function Badge({ tone = 'muted', className, children }) {
  return <span className={cn('bw-badge', `bw-badge-${tone}`, className)}>{children}</span>
}

export function Switch({ checked, onCheckedChange, disabled, id, ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      className={cn('bw-switch', checked && 'is-on')}
      onClick={() => onCheckedChange?.(!checked)}
      {...rest}
    >
      <span className="bw-switch-thumb" />
    </button>
  )
}

export function Spinner({ size = 15, className }) {
  return <Loader2 size={size} className={cn('bw-spin', className)} />
}

export function Empty({ children }) {
  return <p className="bw-empty">{children}</p>
}
