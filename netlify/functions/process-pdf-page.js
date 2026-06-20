// OCR a single PDF page via Claude vision.
//
// POST { image: "data:image/jpeg;base64,...." | base64-without-prefix,
//        mediaType?: "image/jpeg" | "image/png",
//        pageNum: number, totalPages: number }
// -> { markdown: string }
//
// We do ONE page per call so the function stays inside Netlify's 10-26s
// timeout. The browser uploads page-by-page and concatenates results.

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

const SYSTEM = `You extract clean Markdown from images of PDF pages.

Strict rules:
- Output ONLY the markdown content of the page. No preamble ("Here is..."), no postscript, no markdown code fence wrapping the whole answer.
- Math: use LaTeX, with $...$ for inline and $$...$$ for display equations. Do NOT use \\begin{equation} ... \\end{equation} or \\[ ... \\]; always use the dollar-sign form.
- Preserve document structure: # / ## / ### for headings, - or 1. for lists, tables as Markdown tables, **bold** and *italic*.
- For figures / diagrams: write a brief Markdown caption like "**[Figure: short description]**" rather than attempting to OCR pixels inside the figure.
- Omit page numbers, running headers, running footers, watermarks.
- If text is illegible or partly cropped, write [illegible] in its place — do not guess.
- If the page is essentially blank (or only header/footer), return an empty string.
- Never invent content that isn't visibly on the page.`

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
  let { image, mediaType, pageNum, totalPages } = payload
  if (!image) return json(400, { error: 'image is required' })

  // Accept either a data: URL or a bare base64 string.
  if (image.startsWith('data:')) {
    const m = /^data:([^;]+);base64,(.+)$/i.exec(image)
    if (!m) return json(400, { error: 'Invalid data URL' })
    mediaType = mediaType || m[1]
    image = m[2]
  }
  mediaType = mediaType || 'image/jpeg'

  const userText =
    totalPages && pageNum
      ? `This is page ${pageNum} of ${totalPages} of a PDF. Extract its Markdown content.`
      : 'Extract the Markdown content of this PDF page.'

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let response
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: userText }
          ]
        }
      ]
    })
  } catch (e) {
    return json(502, { error: `Anthropic API error: ${e.message || e}` })
  }

  const markdown = response?.content?.[0]?.text ?? ''
  return json(200, { markdown, pageNum: pageNum ?? null })
}
