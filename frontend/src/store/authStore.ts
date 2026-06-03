import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '../types'
import { authAPI } from '../services/api'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await authAPI.login(email, password)
          const { access_token, user } = res.data
          localStorage.setItem('voyageiq_token', access_token)
          set({ user, token: access_token, isLoading: false })
        } catch (err: any) {
          set({ error: err.response?.data?.error || 'Login failed', isLoading: false })
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem('voyageiq_token')
        set({ user: null, token: null })
      },

      loadUser: async () => {
        const token = localStorage.getItem('voyageiq_token')
        if (!token) return
        try {
          const res = await authAPI.me()
          set({ user: res.data, token })
        } catch {
          localStorage.removeItem('voyageiq_token')
          set({ user: null, token: null })
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'voyageiq-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
)
