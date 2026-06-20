// Math RAG search endpoint.
//
// POST { q: string, k?: number } -> { results: Array<chunk> }
//
// Voyage key stays server-side (never shipped to the client). Supabase reads
// go through the anon key because stp_math_* tables have public-read RLS.
//
// Note on `ws`: @supabase/supabase-js v2 unconditionally initializes a
// Realtime client at construction, which requires a WebSocket constructor.
// Netlify Functions run on Node 20 which has no native WebSocket — passing
// the `ws` package as transport keeps the constructor happy even though we
// never open a realtime channel.

import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

const EMBED_MODEL = 'voyage-3'
const DEFAULT_K = 5
const MAX_K = 20

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !VOYAGE_API_KEY) {
    return json(500, { error: 'Server missing env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VOYAGE_API_KEY' })
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const q = (payload.q || '').toString().trim()
  if (!q) return json(400, { error: 'Missing q' })
  const k = Math.min(Math.max(parseInt(payload.k, 10) || DEFAULT_K, 1), MAX_K)

  // 1. Embed the query (input_type=query so Voyage uses the asymmetric variant).
  const embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ input: [q], model: EMBED_MODEL, input_type: 'query' })
  })
  if (!embedRes.ok) {
    const txt = await embedRes.text().catch(() => '')
    return json(502, { error: `Voyage embed failed: ${embedRes.status} ${txt}` })
  }
  const embedJson = await embedRes.json()
  const queryEmbedding = embedJson?.data?.[0]?.embedding
  if (!queryEmbedding) return json(502, { error: 'Voyage returned no embedding' })

  // 2. Vector search via the SQL RPC defined in db/math_schema.sql.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { transport: WebSocket }
  })
  const { data, error } = await supabase.rpc('match_math_chunks', {
    query_embedding: queryEmbedding,
    match_count: k,
    similarity_threshold: 0.0
  })
  if (error) return json(500, { error: error.message })

  return json(200, { results: data ?? [] })
}
