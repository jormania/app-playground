import { originAllowed, rateLimited, clientIp } from './_shared.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ message: 'Use POST.' }); return }
  if (!originAllowed(req.headers.origin)) { res.status(403).json({ message: 'Origin not allowed.' }); return }
  if (rateLimited(clientIp(req))) { res.status(429).json({ message: 'Too many requests — try again shortly.' }); return }

  const payload = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  const apiKey = req.headers['x-api-key'] || payload.apiKey

  if (!apiKey) {
    res.status(401).json({ message: 'Missing API key.' })
    return
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = await anthropicRes.text()
    res.status(anthropicRes.status).send(data)
  } catch (err) {
    res.status(502).json({ message: `Anthropic proxy error: ${err.message}` })
  }
}

function safeParse(str) {
  try { return JSON.parse(str) } catch { return {} }
}
