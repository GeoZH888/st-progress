import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

function fmtDate(s) {
  if (!s) return ''
  try { return new Date(s).toISOString().slice(0, 10) } catch { return s }
}

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

      <p className="admin-sub">{t('admin.rag.uploadHint')}</p>

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
