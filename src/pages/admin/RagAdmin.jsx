import { Fragment, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

function fmtDate(s) {
  if (!s) return ''
  try { return new Date(s).toISOString().slice(0, 10) } catch { return s }
}

// ============================================================
// Browser-side PDF ingest:
//   1. PDF.js renders each page to a JPEG in a canvas
//   2. Each page image is sent to /api/process-pdf-page (Claude vision)
//      which returns Markdown with LaTeX math
//   3. The accumulated Markdown goes to /api/embed-and-store which chunks,
//      embeds via Voyage, and upserts into Supabase
// One page per Claude call so we stay inside Netlify's 10–26s timeout.
// ============================================================
async function ingestOnePdf(file, { onPhase, cancelRef }) {
  // Lazy-load pdfjs only when actually ingesting.
  const pdfjs = await import('pdfjs-dist')
  const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default

  onPhase({ phase: 'reading' })
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const numPages = pdf.numPages

  onPhase({ phase: 'extracting', done: 0, total: numPages })
  const markdownPages = []
  for (let i = 1; i <= numPages; i++) {
    if (cancelRef.current) throw new Error('cancelled')

    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    canvas.width = 0
    canvas.height = 0

    const res = await fetch('/api/process-pdf-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl, pageNum: i, totalPages: numPages })
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new Error(body?.error || `Page ${i}: HTTP ${res.status}`)
    markdownPages.push((body?.markdown || '').trim())
    onPhase({ phase: 'extracting', done: i, total: numPages })
  }

  onPhase({ phase: 'embedding' })
  const fullMarkdown = markdownPages.filter(Boolean).join('\n\n')
  if (!fullMarkdown) throw new Error('No text extracted from any page.')

  const title = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim()
  const res = await fetch('/api/embed-and-store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      title,
      pageCount: numPages,
      markdown: fullMarkdown
    })
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || `Embed: HTTP ${res.status}`)

  return { filename: file.name, pageCount: numPages, chunkCount: body?.chunkCount ?? 0 }
}

function PdfUploader({ onComplete }) {
  const { t } = useTranslation()
  const [state, setState] = useState('idle') // idle | busy | done | error
  const [queue, setQueue] = useState({ total: 0, currentIndex: 0, currentName: '' })
  const [phase, setPhase] = useState(null) // { phase: 'reading'|'extracting'|'embedding', done?, total? }
  const [results, setResults] = useState([]) // [{ filename, ok, chunkCount?, pageCount?, error? }]
  const fileRef = useRef(null)
  const cancelRef = useRef(false)

  async function handleFiles(filesList) {
    const files = Array.from(filesList || []).filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    if (files.length === 0) return

    cancelRef.current = false
    setResults([])
    setState('busy')
    setQueue({ total: files.length, currentIndex: 0, currentName: '' })

    const localResults = []
    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) break
      const file = files[i]
      setQueue({ total: files.length, currentIndex: i + 1, currentName: file.name })
      setPhase({ phase: 'reading' })
      try {
        const out = await ingestOnePdf(file, { onPhase: setPhase, cancelRef })
        localResults.push({ ...out, ok: true })
      } catch (e) {
        if (e.message === 'cancelled') break
        localResults.push({ filename: file.name, ok: false, error: e.message || String(e) })
      }
      setResults([...localResults])
    }

    setPhase(null)
    if (cancelRef.current) {
      setState('idle')
    } else {
      setState(localResults.some((r) => !r.ok) ? 'error' : 'done')
      onComplete?.(localResults)
    }
  }

  const busy = state === 'busy'
  const pct = phase?.total > 0 ? (phase.done / phase.total) * 100 : (busy ? 5 : 0)

  return (
    <div className="admin-uploader">
      <h3 className="admin-uploader-title">📄 {t('admin.rag.upload.title')}</h3>
      <p className="admin-sub">{t('admin.rag.upload.subtitle')}</p>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(e) => { const fs = e.target.files; e.target.value = ''; handleFiles(fs) }}
        hidden
      />

      {!busy && (
        <div className="admin-uploader-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => fileRef.current?.click()}
          >
            {t('admin.rag.upload.choose')}
          </button>
          {results.length > 0 && (
            <ul className="admin-upload-results">
              {results.map((r, i) => (
                <li key={i} className={r.ok ? 'admin-upload-result-ok' : 'admin-upload-result-fail'}>
                  {r.ok ? '✓' : '✗'} <code>{r.filename}</code>
                  {r.ok
                    ? ` — ${t('admin.rag.upload.resultOk', { chunks: r.chunkCount, pages: r.pageCount })}`
                    : ` — ${r.error}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {busy && (
        <div className="admin-upload-progress">
          <div className="admin-upload-label">
            {t('admin.rag.upload.file', { current: queue.currentIndex, total: queue.total, name: queue.currentName })}
          </div>
          <div className="admin-upload-sublabel">
            {phase?.phase === 'reading' && t('admin.rag.upload.reading')}
            {phase?.phase === 'extracting' && t('admin.rag.upload.extracting', { done: phase.done, total: phase.total })}
            {phase?.phase === 'embedding' && t('admin.rag.upload.embedding')}
          </div>
          <div className="admin-upload-bar">
            <div className="admin-upload-fill" style={{ width: `${pct}%` }} />
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => { cancelRef.current = true }}
          >
            {t('admin.cancel')}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Chunk preview (unchanged from before)
// ============================================================
function ChunkPreview({ docId }) {
  const { t } = useTranslation()
  const [chunks, setChunks] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    supabase
      .from('stp_math_chunks')
      .select('id, chunk_index, content, page_start, page_end')
      .eq('doc_id', docId)
      .order('chunk_index', { ascending: true })
      .limit(50)
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error.message)
        else setChunks(data || [])
      })
    return () => { active = false }
  }, [docId])

  if (error) return <div className="admin-error">{error}</div>
  if (chunks === null) return <p>{t('common.loading')}</p>
  if (chunks.length === 0) return <p className="admin-sub">{t('admin.rag.noChunks')}</p>

  return (
    <ol className="admin-list" style={{ margin: '0.5rem 0' }}>
      {chunks.map((c) => (
        <li key={c.id} className="admin-row" style={{ background: '#faf6ec' }}>
          <div className="admin-row-meta" style={{ marginBottom: '0.25rem' }}>
            #{c.chunk_index}
            {c.page_start != null && ` · ${t('admin.rag.page')} ${c.page_start}${c.page_end && c.page_end !== c.page_start ? `–${c.page_end}` : ''}`}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem', lineHeight: 1.5, maxHeight: 180, overflow: 'auto' }}>
            {c.content}
          </div>
        </li>
      ))}
    </ol>
  )
}

// ============================================================
// Main page
// ============================================================
export default function RagAdmin() {
  const { t } = useTranslation()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openChunks, setOpenChunks] = useState(null)

  async function refresh() {
    setLoading(true); setError(null)
    const { data, error } = await supabase
      .from('stp_math_docs_with_counts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setDocs(data || [])
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function handleDelete(id, filename) {
    if (!window.confirm(t('admin.rag.confirmDelete', { filename }))) return
    const { error } = await supabase.from('stp_math_docs').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setDocs((list) => list.filter((d) => d.id !== id))
    if (openChunks === id) setOpenChunks(null)
  }

  const totalChunks = docs.reduce((acc, d) => acc + (d.chunk_count || 0), 0)

  return (
    <div className="admin-page">
      <h1 className="admin-h1">{t('admin.rag.heading')}</h1>
      <p className="admin-sub">
        {t('admin.rag.summary', { docs: docs.length, chunks: totalChunks })}
        {' · '}
        <button type="button" className="admin-btn-link" onClick={refresh}>{t('admin.rag.refresh')}</button>
      </p>

      <PdfUploader onComplete={refresh} />

      {loading && <p>{t('common.loading')}</p>}
      {error && <div className="admin-error">{error}</div>}

      {docs.length > 0 && (
        <table className="admin-doc-table">
          <thead>
            <tr>
              <th>{t('admin.rag.title')}</th>
              <th>{t('admin.rag.filename')}</th>
              <th className="num">{t('admin.rag.pages')}</th>
              <th className="num">{t('admin.rag.chunks')}</th>
              <th>{t('admin.rag.created')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <Fragment key={d.id}>
                <tr>
                  <td>{d.title || '—'}</td>
                  <td><code>{d.filename}</code></td>
                  <td className="num">{d.page_count ?? '—'}</td>
                  <td className="num">{d.chunk_count}</td>
                  <td>{fmtDate(d.created_at)}</td>
                  <td>
                    <button type="button" className="admin-btn admin-btn-ghost"
                      onClick={() => setOpenChunks(openChunks === d.id ? null : d.id)}>
                      {openChunks === d.id ? t('admin.rag.hide') : t('admin.rag.view')}
                    </button>
                    {' '}
                    <button type="button" className="admin-btn admin-btn-danger"
                      onClick={() => handleDelete(d.id, d.filename)}>
                      {t('admin.delete')}
                    </button>
                  </td>
                </tr>
                {openChunks === d.id && (
                  <tr>
                    <td colSpan={6} style={{ background: '#f6efe0' }}>
                      <ChunkPreview docId={d.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
