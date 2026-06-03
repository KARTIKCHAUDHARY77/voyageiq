import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Anchor, Eye, EyeOff, Zap } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, user } = useAuthStore()
  const [email, setEmail] = React.useState('admin@voyageiq.com')
  const [password, setPassword] = React.useState('password123')
  const [showPassword, setShowPassword] = React.useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])

  // Animated particle background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = []
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      })
    }

    let animId: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // Draw grid
      ctx.strokeStyle = 'rgba(20,184,166,0.04)'
      ctx.lineWidth = 1
      for (let x = 0; x < canvas.width; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
      }
      for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
      }
      // Draw particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(14,165,233,${p.alpha})`
        ctx.fill()
      })
      // Connect close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y)
          if (d < 100) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(14,165,233,${0.08 * (1 - d / 100)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animId)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      toast.success('Welcome aboard, Navigator!')
      navigate('/dashboard')
    } catch {
      toast.error('Invalid credentials. Try admin@voyageiq.com / password123')
    }
  }

  return (
    <div className="relative min-h-screen bg-navy-950 flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-ocean-500/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md px-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-ocean-500 shadow-glow-teal mb-4"
          >
            <Anchor className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-teal-400 via-ocean-400 to-teal-300 bg-clip-text text-transparent">
            VoyageIQ AI
          </h1>
          <p className="text-navy-300 mt-2 text-sm tracking-wide">Maritime Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8 rounded-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign In to Dashboard</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-navy-800 border border-navy-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all placeholder-navy-400"
                placeholder="captain@oceancargo.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-navy-800 border border-navy-600 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-teal-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 px-6 bg-gradient-to-r from-teal-600 to-ocean-600 hover:from-teal-500 hover:to-ocean-500 text-white font-semibold rounded-xl shadow-glow-teal transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Zap size={18} />Navigate to Dashboard</>
              )}
            </motion.button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl">
            <p className="text-xs text-teal-400 font-medium mb-2">🚢 Demo Credentials</p>
            <div className="space-y-1 text-xs text-navy-300 font-mono">
              <p><span className="text-navy-400">Admin:</span> admin@voyageiq.com / password123</p>
              <p><span className="text-navy-400">Captain:</span> captain@oceancargo.com / password123</p>
              <p><span className="text-navy-400">Analyst:</span> analyst@oceancargo.com / password123</p>
            </div>
          </div>
        </div>

        <p className="text-center text-navy-500 text-xs mt-6">
          VoyageIQ AI © 2024 · Maritime Intelligence Platform
        </p>
      </motion.div>
    </div>
  )
}
