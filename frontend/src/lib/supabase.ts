/**
 * Supabase Client for Prebloom Frontend
 * 
 * Handles auth and direct Supabase access from the browser.
 * Uses the anon key (RLS-protected, safe for client).
 */

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js'

// Environment detection
const isDev = import.meta.env.DEV

// Supabase config - uses env vars in production, hardcoded for dev
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nyxtykazcgdlyckjijtv.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHR5a2F6Y2dkbHlja2ppanR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NzczMDEsImV4cCI6MjA4NzI1MzMwMX0.DC8CTjo0UaYMkiOVrNjIxeIzPs7VYNeLSKZ5fP8yRso'

// Create Supabase client (singleton)
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Handle OAuth redirects
    flowType: 'pkce', // More secure for SPAs
  },
})

// Export types for convenience
export type { User, Session }

/**
 * Sign in with magic link (passwordless email)
 */
export async function signInWithMagicLink(email: string): Promise<{ error: Error | null }> {
  const redirectTo = `${window.location.origin}/auth/callback`
  
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  })
  
  return { error: error ? new Error(error.message) : null }
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const redirectTo = `${window.location.origin}/auth/callback`
  
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  
  return { error: error ? new Error(error.message) : null }
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut()
  return { error: error ? new Error(error.message) : null }
}

/**
 * Get current session
 */
export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Get current user
 */
export async function getUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Get access token for API calls
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession()
  return session?.access_token || null
}

// Debug logging in dev
if (isDev) {
  console.log('[supabase] Client initialized', { url: SUPABASE_URL })
}
