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
function PdfUploader({ onComplete }) {
  const { t } = useTranslation()
  const [state, setState] = useState('idle') // idle | reading | extracting | embedding | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [info, setInfo] = useState(null) // { chunkCount } on success
  const [error, setError] = useState(null)
  const fileRef = useRef(null)
  const cancelRef = useRef(false)

  async function handleFile(file) {
    if (!file) return
    cancelRef.current = false
    setError(null)
    setInfo(null)
    setState('reading')
    setProgress({ done: 0, total: 0 })

    try {
      // Dynamic import keeps pdf.js out of the initial bundle.
      const pdfjs = await import('pdfjs-dist')
      const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
      const numPages = pdf.numPages

      setState('extracting')
      setProgress({ done: 0, total: numPages })

      const markdownPages = []
      for (let i = 1; i <= numPages; i++) {
        if (cancelRef.current) throw new Error('cancelled')

        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2.0 }) // 2× DPI for OCR
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport }).promise
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        // Free the canvas memory early.
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
        setProgress({ done: i, total: numPages })
      }

      setState('embedding')
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

      setInfo({ chunkCount: body?.chunkCount ?? 0, pageCount: numPages, filename: file.name })
      setState('done')
      onComplete?.(body)
    } catch (e) {
      if (e.message === 'cancelled') {
        setState('idle')
      } else {
        setError(e.message || String(e))
        setState('error')
      }
    }
  }

  const busy = state === 'reading' || state === 'extracting' || state === 'embedding'
  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : (busy ? 5 : 0)

  return (
    <div className="admin-uploader">
      <h3 className="admin-uploader-title">📄 {t('admin.rag.upload.title')}</h3>
      <p className="admin-sub">{t('admin.rag.upload.subtitle')}</p>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleFile(f) }}
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
          {state === 'done' && info && (
            <span className="admin-success">
              ✓ {t('admin.rag.upload.doneMsg', { filename: info.filename, chunks: info.chunkCount, pages: info.pageCount })}
            </span>
          )}
          {state === 'error' && <div className="admin-error">{error}</div>}
        </div>
      )}

      {busy && (
        <div className="admin-upload-progress">
          <div className="admin-upload-label">
            {state === 'reading' && t('admin.rag.upload.reading')}
            {state === 'extracting' && t('admin.rag.upload.extracting', { done: progress.done, total: progress.total })}
            {state === 'embedding' && t('admin.rag.upload.embedding')}
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
