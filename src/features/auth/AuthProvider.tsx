import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'
import { onIdTokenChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { firebaseAuth } from '../../lib/firebase/client'

/* The provider and its colocated hook intentionally share one module. */
/* eslint-disable react-refresh/only-export-components */

export type AppRole = 'student' | 'teacher' | 'admin'
type AuthState = { session: Session | null; role: AppRole | null; loading: boolean; authError: string; recovering: boolean; finishRecovery: () => void; signOut: () => Promise<void> }
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<AppRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [recovering, setRecovering] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'resetPassword')

  useEffect(() => {
    let generation = 0
    let active = true
    const unsubscribe = onIdTokenChanged(firebaseAuth, user => {
      const current = ++generation
      setLoading(true)
      setSession(null)
      setRole(null)
      setAuthError('')
      void (async () => {
        await supabase.auth.signOut({ scope: 'local' })
        if (!user || !user.emailVerified) return
        const token = await user.getIdToken()
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firebase-session`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Could not connect to your classroom.')
        if (!active || current !== generation) return
        const { data, error } = await supabase.auth.setSession(result)
        if (error) throw error
        const { data: profile, error: profileError } = await supabase.from('cs_profiles').select('role').eq('id', data.session!.user.id).single()
        if (profileError) throw new Error('Could not load your classroom permissions. Please sign in again.')
        if (active && current === generation) {
          setSession(data.session)
          setRole(profile.role as AppRole)
        }
      })().catch(error => {
        if (active && current === generation) setAuthError(error instanceof Error ? error.message : 'Could not connect to your classroom.')
      }).finally(() => { if (active && current === generation) setLoading(false) })
    })
    return () => { active = false; generation++; unsubscribe() }
  }, [])

  const value = useMemo(() => ({ session, role, loading, authError, recovering, finishRecovery: () => {
    const url = new URL(window.location.href)
    for (const key of ['recovery', 'mode', 'oobCode', 'apiKey', 'lang', 'continueUrl']) url.searchParams.delete(key)
    url.hash = '/login'
    window.history.replaceState(null, '', url)
    setRecovering(false)
  }, signOut: async () => { await firebaseSignOut(firebaseAuth); await supabase.auth.signOut() } }), [session, role, loading, authError, recovering])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
