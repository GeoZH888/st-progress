import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Thin Supabase Auth wrapper. The session lives in Supabase's own localStorage,
 * this just exposes it to React via context + a tiny hook.
 */

const AuthContext = createContext({ session: null, loading: true })

export function AuthProvider({ children }) {
  const [state, setState] = useState({ session: null, loading: true })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false })
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useSession() {
  return useContext(AuthContext)
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}
