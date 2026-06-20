// Take a full document's Markdown, chunk it (LaTeX-preserving), embed each
// chunk via Voyage voyage-3, and upsert into stp_math_docs / stp_math_chunks.
//
// POST { filename, title?, pageCount?, markdown }
// -> { docId, chunkCount }
//
// Uses the service-role key because the inserts need to bypass RLS. Mirrors
// the chunk/embed/upsert logic of scripts/ingest_pdfs.py so search results
// from CLI-ingested and browser-ingested PDFs are interchangeable.

import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

const EMBED_MODEL = 'voyage-3'
const CHUNK_TARGET_CHARS = 1200
const CHUNK_MAX_CHARS = 2000
const EMBED_BATCH = 64

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  }
}

// Replace $$...$$ blocks with sentinels so they don't get split by the
// paragraph splitter, then restore. Same idea as the Python pipeline.
const MATH_BLOCK_RE = /\$\$[\s\S]*?\$\$/g
const SENT_RE = /\x00MATH\d+\x00/g

function splitParagraphs(markdown) {
  const placeholders = []
  const protectedMd = markdown.replace(MATH_BLOCK_RE, (m) => {
    const key = `\x00MATH${placeholders.length}\x00`
    placeholders.push(m)
    return key
  })
  const paras = protectedMd.split(/\n\s*\n/)
  const out = []
  for (let p of paras) {
    p = p.replace(SENT_RE, (k) => {
      const idx = parseInt(k.match(/\d+/)[0], 10)
      return placeholders[idx] ?? k
    })
    const t = p.trim()
    if (t) out.push(t)
  }
  return out
}

function chunkMarkdown(md) {
  const chunks = []
  let buf = []
  let bufLen = 0
  for (const para of splitParagraphs(md)) {
    const plen = para.length
    if (buf.length && bufLen + plen + 2 > CHUNK_MAX_CHARS) {
      chunks.push(buf.join('\n\n'))
      buf = []
      bufLen = 0
    }
    buf.push(para)
    bufLen += plen + 2
    if (bufLen >= CHUNK_TARGET_CHARS) {
      chunks.push(buf.join('\n\n'))
      buf = []
      bufLen = 0
    }
  }
  if (buf.length) chunks.push(buf.join('\n\n'))
  return chunks
}

async function embedBatch(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ input: texts, model: EMBED_MODEL, input_type: 'document' })
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Voyage embed failed: ${res.status} ${t}`)
  }
  const body = await res.json()
  return (body.data || []).map((d) => d.embedding)
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json(500, { error: 'Server missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }
  if (!VOYAGE_API_KEY) return json(500, { error: 'Server missing VOYAGE_API_KEY' })

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }
  const { filename, title, pageCount, markdown } = payload
  if (!filename || !markdown) {
    return json(400, { error: 'filename and markdown are required' })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    realtime: { transport: WebSocket }
  })

  // Upsert the doc row (wipe old chunks on re-ingest, like ingest_pdfs.py).
  const existing = await sb
    .from('stp_math_docs')
    .select('id')
    .eq('filename', filename)
    .limit(1)
  if (existing.error) return json(500, { error: `Find doc: ${existing.error.message}` })

  let docId
  if (existing.data && existing.data.length) {
    docId = existing.data[0].id
    await sb.from('stp_math_chunks').delete().eq('doc_id', docId)
    await sb
      .from('stp_math_docs')
      .update({ title: title || filename, page_count: pageCount ?? null })
      .eq('id', docId)
  } else {
    const inserted = await sb
      .from('stp_math_docs')
      .insert({
        filename,
        title: title || filename,
        source_path: `uploaded/${filename}`,
        page_count: pageCount ?? null
      })
      .select('id')
      .single()
    if (inserted.error) return json(500, { error: `Create doc: ${inserted.error.message}` })
    docId = inserted.data.id
  }

  const chunks = chunkMarkdown(markdown)
  if (chunks.length === 0) {
    return json(200, { docId, chunkCount: 0 })
  }

  // Embed in batches; each Voyage call covers up to EMBED_BATCH chunks.
  try {
    for (let start = 0; start < chunks.length; start += EMBED_BATCH) {
      const batch = chunks.slice(start, start + EMBED_BATCH)
      const embeddings = await embedBatch(batch)
      const rows = batch.map((content, i) => ({
        doc_id: docId,
        chunk_index: start + i,
        content,
        embedding: embeddings[i]
      }))
      const ins = await sb.from('stp_math_chunks').insert(rows)
      if (ins.error) throw new Error(ins.error.message)
    }
  } catch (e) {
    return json(502, { error: `Embed/insert failed: ${e.message || e}` })
  }

  return json(200, { docId, chunkCount: chunks.length })
}
