import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from './supabase'

/**
 * Runs an async loader and tracks {data, loading, error}.
 * `deps` re-runs the loader when they change (e.g. a route param).
 * Short-circuits to an error if Supabase isn't configured yet.
 */
export function useFetch(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })

  useEffect(() => {
    let active = true
    setState({ data: null, loading: true, error: null })

    if (!isSupabaseConfigured) {
      setState({ data: null, loading: false, error: new Error('SUPABASE_NOT_CONFIGURED') })
      return
    }

    loader()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }))

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
