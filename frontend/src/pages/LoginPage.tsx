import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Anchor, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, user } = useAuthStore()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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
    <div className="min-h-[100dvh] bg-base flex items-center justify-center px-4">
      <div className="login-enter w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-600">
            <Anchor className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight">VoyageIQ</h1>
            <p className="text-xs text-navy-300">Vessel performance and voyage analytics</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4" noValidate>
          <h2 className="text-base font-semibold text-white">Sign in</h2>

          <div>
            <label htmlFor="email" className="block text-sm text-navy-300 mb-1.5">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="maritime-input w-full px-3 py-2.5"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-navy-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="maritime-input w-full px-3 py-2.5 pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-navy-300 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="btn-primary w-full py-2.5 px-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="text-xs text-navy-400 mt-6">
          Need access? Ask your administrator to create an account.
        </p>
      </div>
    </div>
  )
}
