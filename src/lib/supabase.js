import { createClient } from '@supabase/supabase-js'

// Values come from .env (see .env.example). Vite exposes only VITE_-prefixed vars.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Flag used by pages to show a friendly "configure Supabase" message instead
// of crashing when the .env hasn't been filled in yet.
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'your-supabase-project-url' &&
    supabaseAnonKey !== 'your-supabase-anon-key'
)

// Create the client even with placeholder values so imports don't throw;
// calls simply fail and pages handle the error gracefully.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
)

/**
 * Pick the right per-language column from a row.
 * e.g. localized(milestone, 'title', 'zh') -> milestone.title_zh
 * (falls back through en -> it -> zh so nothing renders blank).
 */
export function localized(row, field, lang) {
  if (!row) return ''
  const order = [lang, 'en', 'it', 'zh']
  for (const code of order) {
    const val = row[`${field}_${code}`]
    if (val) return val
  }
  return ''
}
