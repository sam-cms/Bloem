/**
 * Auth Context for Prebloom
 * 
 * Provides authentication state throughout the app.
 * Handles session persistence, OAuth callbacks, and auth state changes.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabase, User, Session, signInWithMagicLink, signInWithGoogle, signOut as supabaseSignOut } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  })

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user || null,
        loading: false,
      }))
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[auth] State change:', event, session?.user?.email)
        
        setState(prev => ({
          ...prev,
          session,
          user: session?.user || null,
          loading: false,
          // Clear error on successful auth
          error: event === 'SIGNED_IN' ? null : prev.error,
        }))

        // Handle sign in - could create user profile here
        if (event === 'SIGNED_IN' && session?.user) {
          // Profile creation handled by backend on first API call
          console.log('[auth] User signed in:', session.user.email)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Sign in with email (magic link)
  const handleSignInWithEmail = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    const { error } = await signInWithMagicLink(email)
    
    setState(prev => ({
      ...prev,
      loading: false,
      error: error?.message || null,
    }))
    
    return { error }
  }, [])

  // Sign in with Google
  const handleSignInWithGoogle = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    const { error } = await signInWithGoogle()
    
    // Note: For OAuth, the page redirects, so loading state persists
    // Error is only set if the redirect fails
    if (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }))
    }
    
    return { error }
  }, [])

  // Sign out
  const handleSignOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    
    const { error } = await supabaseSignOut()
    
    setState(prev => ({
      ...prev,
      user: null,
      session: null,
      loading: false,
      error: error?.message || null,
    }))
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const value: AuthContextValue = {
    ...state,
    signInWithEmail: handleSignInWithEmail,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
    clearError,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Hook for components that only need to know if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { user } = useAuth()
  return !!user
}
