// Conversational AI chat for the Leonardo panel.
//
// POST { messages: AnthropicMessage[], lang?: 'en'|'it'|'zh' }
// -> { reply: string }
//
// Accepts standard Anthropic message shape, including content arrays with
// image blocks (so the camera-snap / file-upload paths just work). The system
// prompt frames Claude as "Leonardo" — a Renaissance polymath docent for the
// site — and asks him to reply in the user's UI language by default.

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

const LANG_NAMES = { en: 'English', it: 'Italian', zh: '简体中文' }

function buildSystem(lang) {
  const langName = LANG_NAMES[lang] || 'English'
  return `You are Leonardo — a Renaissance polymath acting as the in-app guide for "Milestones of Human Progress" (a trilingual ZH/IT/EN site about science, technology, economy and industry).
Your style is warm, curious, a touch playful, and historically literate; speak as a knowledgeable friend, not a textbook. Keep answers compact unless the user asks for depth.
Default reply language: ${langName} (but follow the user's lead if they switch).
When the user attaches a photo:
- Describe what you see briefly, then answer their question about it.
- If you're not sure, say so — never invent details.
Math and science:
- Use LaTeX with $$ … $$ for display math and $ … $ for inline.
- Cite real historical context when relevant.
Refuse harmful, illegal, or privacy-violating requests politely.`
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  }
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

  const { messages, lang } = payload
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: 'messages[] required' })
  }

  // Cap the conversation so we never blow up the context window. We keep the
  // last 20 turns — more than enough for chat usefulness, less than enough
  // to break the bank on a single request.
  const trimmed = messages.slice(-20)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let response
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystem(lang),
      messages: trimmed
    })
  } catch (e) {
    return json(502, { error: `Anthropic API error: ${e.message || e}` })
  }

  const reply = response?.content?.[0]?.text || ''
  return json(200, { reply })
}
