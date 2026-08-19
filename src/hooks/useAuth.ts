import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { supabase } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import { useOrganization } from './useOrganization'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  error: string | null
  isInitialized: boolean

  loginWithGoogle: () => Promise<void>
  loginWithEmail: (email: string, password: string) => Promise<void>
  signupWithEmail: (email: string, password: string) => Promise<void>
  loginWithOtp: (email: string) => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  initializeAuth: () => () => void // Returns an unsubscribe function
}

export const useAuth = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      session: null,
      isLoading: true,
      error: null,
      isInitialized: false,

      clearError: () => set({ error: null }),

      loginWithEmail: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          })
          if (error) throw error
          set({ user: data.user, session: data.session, isLoading: false })
          useOrganization.getState().loadUserOrganization().catch(() => {})
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      signupWithEmail: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const cleanEmail = email.trim().toLowerCase()
          const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
          })
          if (error) throw error
          set({ user: data.user, session: data.session, isLoading: false })
          if (data.session) {
            useOrganization.getState().loadUserOrganization().catch(() => {})
          }
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      loginWithOtp: async (email: string) => {
        set({ isLoading: true, error: null })
        try {
          const cleanEmail = email.trim().toLowerCase()
          const { error } = await supabase.auth.signInWithOtp({
            email: cleanEmail,
            options: {
              emailRedirectTo: window.location.origin,
            },
          })
          if (error) throw error
          set({ isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      resetPasswordForEmail: async (email: string) => {
        set({ isLoading: true, error: null })
        try {
          const cleanEmail = email.trim().toLowerCase()
          const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: window.location.origin,
          })
          if (error) throw error
          set({ isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      updatePassword: async (password: string) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await supabase.auth.updateUser({
            password,
          })
          if (error) throw error
          set({ user: data.user, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null })
        try {
          const redirectTo = `${window.location.origin}`
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo,
            },
          })
          if (error) throw error
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      logout: async () => {
        set({ isLoading: true, error: null })
        try {
          const { error } = await supabase.auth.signOut()
          if (error) throw error
          set({ user: null, session: null, isLoading: false })
          useOrganization.getState().clear()
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      initializeAuth: () => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (error) {
            set({ error: error.message, isLoading: false, isInitialized: true })
          } else {
            set({
              session,
              user: session?.user ?? null,
              isLoading: false,
              isInitialized: true,
            })
            if (session?.user) {
              useOrganization.getState().loadUserOrganization().catch(() => {})
            }
          }
        })

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            set({
              session,
              user: session?.user ?? null,
              isLoading: false,
            })
            if (session?.user) {
              useOrganization.getState().loadUserOrganization().catch(() => {})
            } else {
              useOrganization.getState().clear()
            }
          }
        )

        return () => {
          subscription.unsubscribe()
        }
      },
    }),
    { name: 'AuthStore' }
  )
)
