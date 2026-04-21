// Vercel serverless function — proxies client requests to the Anthropic API.
// The API key lives in process.env.ANTHROPIC_API_KEY (set in the Vercel
// dashboard). The client never sees the key.
//
// Contract: POST body is forwarded as-is to Anthropic's /v1/messages endpoint.
// This keeps the client flexible: system prompt, model, tool config, etc. are
// all assembled client-side in src/lib/ai.js.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (error) {
    console.error('api/ai: upstream error', error)
    return res.status(500).json({ error: 'Failed to call AI service' })
  }
}
