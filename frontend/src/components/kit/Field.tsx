import React, { useId } from 'react'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  /** Render prop receives the ids needed to wire the control to its label and messages. */
  children: (a11y: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode
  className?: string
}

/** Label + control + hint/error, with the ids connected so screen readers announce them. */
export function Field({ label, hint, error, children, className = '' }: FieldShellProps) {
  const id = useId()
  const messageId = `${id}-msg`
  const message = error || hint
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-label text-fg-muted mb-1.5">{label}</label>
      {children({ id, 'aria-describedby': message ? messageId : undefined, 'aria-invalid': error ? true : undefined })}
      {message && (
        <p id={messageId} className={`mt-1.5 text-label ${error ? 'text-signal-port' : 'text-fg-subtle'}`} role={error ? 'alert' : undefined}>
          {message}
        </p>
      )}
    </div>
  )
}

const CONTROL =
  'w-full h-9 px-3 rounded-ctl bg-surface-1 text-body text-fg placeholder:text-fg-subtle ' +
  'border border-line-strong transition-[border-color,background-color] duration-[150ms] ease-out ' +
  'hover:border-fg-subtle/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ' +
  'aria-[invalid=true]:border-signal-port disabled:opacity-50'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`${CONTROL} tabular-nums ${className}`} {...rest} />
})

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={`${CONTROL} pr-8 ${className}`} {...rest}>
      {children}
    </select>
  )
})
