import { create } from 'zustand'
import { api, setUnauthorizedHandler, ApiError } from '@/lib/api'
import type { User } from '@/lib/types'
import { queryClient } from '@/lib/query'

interface AuthState {
  user: User | null
  status: 'loading' | 'authenticated' | 'anonymous'
  init: () => Promise<void>
  requestOtp: (email: string) => Promise<void>
  verifyOtp: (email: string, code: string) => Promise<User>
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  init: async () => {
    setUnauthorizedHandler(() => { queryClient.clear(); set({ user: null, status: 'anonymous' }) })
    try { set({ user: await api.get<User>('/api/auth/me'), status: 'authenticated' }) } catch { set({ user: null, status: 'anonymous' }) }
  },
  requestOtp: async email => { await api.post('/api/auth/otp/request', { email }) },
  verifyOtp: async (email, code) => {
    const u = await api.post<User>('/api/auth/otp/verify', { email, code })
    queryClient.clear(); set({ user: u, status: 'authenticated' }); return u
  },
  logout: async () => {
    try { await api.post('/api/auth/logout') } catch (e) { if (!(e instanceof ApiError)) throw e }
    queryClient.clear(); set({ user: null, status: 'anonymous' })
  },
}))
export const useIsAdmin = () => useAuth(s => s.user?.role === 'Admin')
