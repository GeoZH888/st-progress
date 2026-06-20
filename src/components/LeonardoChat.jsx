import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import './LeonardoChat.css'

// Per-route greetings so Leonardo opens with something relevant to where the
// user is. Falls back to the default greeting (`leo.greet`) for any path
// without a tailored entry.
function greetingKeyForPath(pathname) {
  if (pathname.startsWith('/math'))      return 'leo.greetMath'
  if (pathname.startsWith('/gallery'))   return 'leo.greetGallery'
  if (pathname.startsWith('/milestone')) return 'leo.greetMilestone'
  return 'leo.greet'
}

// ============================================================
// Tiny unique ID for message keys (no crypto required).
// ============================================================
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// ============================================================
// Camera capture: takes over the input area while the user lines up a shot.
// Uses rear camera ("environment") by default; falls back to whichever camera
// the browser hands us.
// ============================================================
function CameraCapture({ onCapture, onCancel, t }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t('leo.cameraUnsupported'))
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setReady(true)
      } catch (e) {
        setError(e.message || String(e))
      }
    }
    start()
    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [t])

  function snap() {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    onCapture(canvas.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="leo-camera">
      {error ? (
        <div className="leo-error">{error}</div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="leo-camera-video" />
      )}
      <div className="leo-camera-bar">
        <button type="button" className="leo-btn-ghost" onClick={onCancel}>
          {t('leo.cancel')}
        </button>
        <button type="button" className="leo-btn-primary" onClick={snap} disabled={!ready}>
          📷 {t('leo.snap')}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Speech-to-text: Web Speech API (Chrome / Edge / Safari iOS reliable;
// Firefox not supported — UI hides the mic button when unsupported).
// ============================================================
function useSpeechRecognition(lang) {
  const recRef = useRef(null)
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)

  useEffect(() => {
    const Klass = window.SpeechRecognition || window.webkitSpeechRecognition
    setSupported(Boolean(Klass))
    return () => {
      if (recRef.current) {
        try { recRef.current.abort() } catch { /* noop */ }
      }
    }
  }, [])

  function start({ onResult, onEnd }) {
    const Klass = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Klass) return
    const rec = new Klass()
    rec.lang = { en: 'en-US', it: 'it-IT', zh: 'zh-CN' }[lang] || 'en-US'
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = (event) => {
      const r = event.results[event.results.length - 1]
      onResult(r[0].transcript, r.isFinal)
    }
    rec.onend = () => {
      setListening(false)
      onEnd?.()
    }
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }
  function stop() {
    if (recRef.current) {
      try { recRef.current.stop() } catch { /* noop */ }
    }
  }
  return { supported, listening, start, stop }
}

// ============================================================
// Main chat panel
// ============================================================
export default function LeonardoChat({ open, onClose }) {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const greetingKey = useMemo(() => greetingKeyForPath(pathname), [pathname])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [staged, setStaged] = useState(null) // { dataUrl, base64, mediaType }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  const fileInputRef = useRef(null)
  const messagesRef = useRef(null)
  const speech = useSpeechRecognition(i18n.language)

  // Auto-scroll the message list to the bottom on new messages / typing-loader.
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, loading])

  // Greet the first time the panel opens — pick a route-aware variant so the
  // first line feels relevant to where the user is. The greeting is local-only;
  // it isn't sent to Claude (would just waste tokens).
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        { id: 'greet', role: 'assistant', textPreview: t(greetingKey, t('leo.greet')), local: true }
      ])
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function stageImage(dataUrl) {
    const [meta, b64] = dataUrl.split(',')
    const mediaType = /data:([^;]+);/.exec(meta)?.[1] || 'image/jpeg'
    setStaged({ dataUrl, base64: b64, mediaType })
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => stageImage(reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSend() {
    const text = input.trim()
    if ((!text && !staged) || loading) return

    // Build the user message in both UI shape and API shape.
    const apiContent = staged
      ? [
          {
            type: 'image',
            source: { type: 'base64', media_type: staged.mediaType, data: staged.base64 }
          },
          ...(text ? [{ type: 'text', text }] : [])
        ]
      : text

    const userMsg = {
      id: newId(),
      role: 'user',
      apiContent,
      imagePreview: staged?.dataUrl,
      textPreview: text
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setStaged(null)
    setLoading(true)
    setError(null)

    try {
      const apiMessages = nextMessages
        .filter((m) => !m.local)
        .map((m) => ({
          role: m.role,
          content: m.apiContent ?? m.textPreview
        }))

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, lang: i18n.language })
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          textPreview: body.reply,
          apiContent: body.reply
        }
      ])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleMic() {
    if (!speech.supported) return
    if (speech.listening) {
      speech.stop()
    } else {
      speech.start({ onResult: (transcript) => setInput(transcript) })
    }
  }

  function clearChat() {
    setMessages([])
    setStaged(null)
    setError(null)
  }

  if (!open) return null

  return (
    <div className="leo-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <aside className="leo-panel" onClick={(e) => e.stopPropagation()}>
        <header className="leo-header">
          <img src="/mascots/leonardo.png" alt="" className="leo-header-avatar" />
          <div className="leo-header-name">
            <strong>{t('mascot.name')}</strong>
            <span>{t('leo.subtitle')}</span>
          </div>
          <button type="button" className="leo-header-action" onClick={clearChat} title={t('leo.clear')} aria-label={t('leo.clear')}>
            ↺
          </button>
          <button type="button" className="leo-header-action" onClick={onClose} aria-label={t('leo.close')}>
            ×
          </button>
        </header>

        <div className="leo-messages" ref={messagesRef}>
          {messages.map((m) => (
            <div key={m.id} className={`leo-msg leo-msg-${m.role}`}>
              {m.imagePreview && <img src={m.imagePreview} alt="" className="leo-msg-image" />}
              {m.textPreview && <div className="leo-msg-text">{m.textPreview}</div>}
            </div>
          ))}
          {loading && (
            <div className="leo-msg leo-msg-assistant leo-msg-loading">
              <span className="leo-dot" /><span className="leo-dot" /><span className="leo-dot" />
            </div>
          )}
          {error && <div className="leo-error">{error}</div>}
        </div>

        {cameraOpen ? (
          <CameraCapture
            t={t}
            onCancel={() => setCameraOpen(false)}
            onCapture={(dataUrl) => {
              stageImage(dataUrl)
              setCameraOpen(false)
            }}
          />
        ) : (
          <>
            {staged && (
              <div className="leo-staged">
                <img src={staged.dataUrl} alt="" />
                <button type="button" onClick={() => setStaged(null)} aria-label={t('leo.removeImage')}>
                  ×
                </button>
              </div>
            )}
            <div className="leo-input-bar">
              <button type="button" className="leo-icon" onClick={() => setCameraOpen(true)} title={t('leo.camera')} aria-label={t('leo.camera')}>
                📷
              </button>
              <button type="button" className="leo-icon" onClick={() => fileInputRef.current?.click()} title={t('leo.upload')} aria-label={t('leo.upload')}>
                📎
              </button>
              {speech.supported && (
                <button
                  type="button"
                  className={`leo-icon${speech.listening ? ' on' : ''}`}
                  onClick={toggleMic}
                  title={t('leo.mic')}
                  aria-label={t('leo.mic')}
                  aria-pressed={speech.listening}
                >
                  🎤
                </button>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={t('leo.placeholder')}
                disabled={loading}
                className="leo-text-input"
              />
              <button
                type="button"
                className="leo-send"
                onClick={handleSend}
                disabled={loading || (!input.trim() && !staged)}
                aria-label={t('leo.send')}
              >
                ↑
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} hidden />
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
