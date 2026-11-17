import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

export function FieldShell({ label, hint, error, required, children }: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-1.5 text-xs font-normal text-rust">
            必須
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs leading-relaxed text-rust" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

const control =
  'block w-full rounded-md border bg-white px-3 py-2 text-[15px] text-charcoal placeholder:text-muted/70 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink'

type Common = { label: string; hint?: string; error?: string }

export function TextField({ label, hint, error, required, className = '', ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          required={required}
          className={`${control} h-10 ${invalid ? 'border-rust' : 'border-line-strong'} ${className}`}
          {...rest}
        />
      )}
    </FieldShell>
  )
}

export function TextAreaField({ label, hint, error, required, className = '', rows = 4, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          required={required}
          className={`${control} leading-relaxed ${invalid ? 'border-rust' : 'border-line-strong'} ${className}`}
          {...rest}
        />
      )}
    </FieldShell>
  )
}

export function SelectField({ label, hint, error, required, className = '', children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          required={required}
          className={`${control} h-10 ${invalid ? 'border-rust' : 'border-line-strong'} ${className}`}
          {...rest}
        >
          {children}
        </select>
      )}
    </FieldShell>
  )
}
