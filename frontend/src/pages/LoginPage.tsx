import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Anchor, Eye, EyeOff } from 'lucide-react'
import { Button, Field, Input } from '../components/kit'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, user } = useAuthStore()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  useEffect(() => { document.title = 'Sign in · VoyageIQ' }, [])

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login(email.trim(), password)
      navigate('/dashboard')
    } catch (err: any) {
      const status = err?.response?.status
      const message =
        status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : status === 401
            ? 'Email or password is incorrect.'
            : 'Could not reach the server. Try again.'
      setError(message)
      toast.error(message)
    }
  }

  return (
    <main className="min-h-[100dvh] bg-base flex items-center justify-center px-4">
      <div className="login-enter w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <span className="flex items-center justify-center w-10 h-10 rounded-ctl bg-accent text-base" aria-hidden>
            <Anchor className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lead font-semibold text-fg leading-tight">VoyageIQ</h1>
            <p className="text-label text-fg-muted">Vessel performance and voyage analytics</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-1 border border-line rounded-panel p-6 space-y-4" noValidate>
          <h2 className="text-body font-semibold text-fg">Sign in</h2>

          <Field label="Email">
            {a11y => (
              <Input {...a11y} type="email" autoComplete="username" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} required />
            )}
          </Field>

          <Field label="Password">
            {a11y => (
              <div className="relative">
                <Input {...a11y} type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="pr-11" required />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-fg-muted hover:text-fg rounded-ctl focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}
          </Field>

          {error && <p role="alert" className="text-body text-signal-port">{error}</p>}

          <Button type="submit" variant="primary" loading={isLoading} disabled={!email || !password} className="w-full">Sign in</Button>
        </form>

        <p className="text-label text-fg-subtle mt-6">Need access? Ask your administrator to create an account.</p>
      </div>
    </main>
  )
}
