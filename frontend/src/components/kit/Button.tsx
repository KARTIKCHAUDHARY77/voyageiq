import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-base hover:bg-accent-strong border border-transparent',
  secondary: 'bg-surface-2 text-fg border border-line-strong hover:bg-surface-2/60',
  ghost: 'bg-transparent text-fg-muted border border-transparent hover:bg-fg/5 hover:text-fg',
  danger: 'bg-signal-port/10 text-signal-port border border-signal-port/30 hover:bg-signal-port/20',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-label gap-1.5',
  md: 'h-9 px-4 text-body gap-2',
}

/**
 * Press feedback is a 3% scale-down (140ms, ease-out). Hover colour changes are
 * gated to devices that can hover, so touch screens do not get stuck states.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center rounded-ctl font-medium select-none',
        'transition-[background-color,border-color,color,transform] duration-[140ms] ease-out',
        'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})
