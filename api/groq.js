// Simple Vercel serverless proxy for Groq Llama 3.1 8B Instant
// Usage: deploy to Vercel and set environment variable GROQ_API_KEY

module.exports = async (req, res) => {
  // Basic CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY is not set' });

  try {
    const { messages, systemInstruction } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'Messages array is required' });

    const chatMessages = [];
    if (systemInstruction) chatMessages.push({ role: 'system', content: systemInstruction });

    messages.forEach((m) => {
      if (m && typeof m.content === 'string' && typeof m.role === 'string') {
        chatMessages.push({ role: m.role, content: m.content });
      }
    });

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 256,
        stream: false,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(upstream.status).json({ error: 'Upstream error', detail });
    }

    const data = await upstream.json();
    const message = data?.choices?.[0]?.message?.content;
    return res.status(200).json({ message, choices: data?.choices, usage: data?.usage });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
