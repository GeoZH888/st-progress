// Editorial AI assistant for the admin panel.
//
// POST { kind: 'translate', sourceLang, sourceText, targetLangs[], field? }
// POST { kind: 'draft',     topic, languages[], field }
// -> { translations: { <lang>: string, ... } }
//
// Anthropic API key stays server-side. The function does no auth check — the
// admin RLS on the database is the security boundary. This endpoint *could*
// be abused to burn through the API key, so consider adding a JWT check or
// rate limit if abuse becomes an issue.

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

const SYSTEM = `You are an editorial assistant for a trilingual (English, Italian, 中文) site about milestones of human progress in science, technology, economy and industry.
You write concise, neutral, historically accurate copy and respect each language's punctuation and stylistic conventions.
When the user asks for JSON, return ONLY the JSON object — no prose, no markdown code fences.`

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  }
}

function buildPrompt(payload) {
  const { kind } = payload
  if (kind === 'translate') {
    const { sourceLang, sourceText, targetLangs, field } = payload
    if (!sourceText || !sourceLang || !targetLangs?.length) {
      throw new Error('translate needs sourceLang, sourceText, targetLangs[]')
    }
    return `Field: ${field || 'text'}
Source language: ${sourceLang}
Source text:
${sourceText}

Translate the source text into each of: ${targetLangs.join(', ')}.
Preserve proper names, dates and numbers.
${field === 'title' || field === 'name' ? 'Keep it the same length as the source.' : 'Keep the same tone and length.'}
Return ONLY a JSON object mapping language code to translation, e.g. {"en": "…", "it": "…"}.`
  }

  if (kind === 'draft') {
    const { topic, languages, field } = payload
    if (!topic || !languages?.length) {
      throw new Error('draft needs topic, languages[]')
    }
    const lenHint =
      field === 'title' ? '3–6 words' :
      field === 'name'  ? '2–4 words' :
      field === 'bio'   ? '2–4 sentences' :
                          '1–2 sentences'
    return `Write a ${field || 'description'} (${lenHint}) for a milestone of human progress about:
${topic}

Languages: ${languages.join(', ')}.
Be historically accurate and neutral.
Return ONLY a JSON object mapping language code to text, e.g. {"en": "…", "it": "…", "zh": "…"}.`
  }

  throw new Error(`Unknown kind: ${kind}`)
}

function extractJson(text) {
  // Claude usually returns clean JSON; tolerate ```json fences just in case.
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  return JSON.parse(trimmed)
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, { error: 'Server missing ANTHROPIC_API_KEY' })
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  let userMessage
  try {
    userMessage = buildPrompt(payload)
  } catch (e) {
    return json(400, { error: e.message })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let response
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMessage }]
    })
  } catch (e) {
    return json(502, { error: `Anthropic API error: ${e.message || e}` })
  }

  const text = response?.content?.[0]?.text || ''
  let parsed
  try {
    parsed = extractJson(text)
  } catch {
    return json(502, { error: 'Model did not return valid JSON', raw: text })
  }

  return json(200, { translations: parsed })
}
