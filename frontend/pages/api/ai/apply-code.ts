import type { NextApiRequest, NextApiResponse } from 'next';

// Frontend proxy to avoid browser CORS preflight issues.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL as string;
  if (!backendUrl) return res.status(500).json({ error: 'NEXT_PUBLIC_BACKEND_URL not set' });
  try {
    const r = await fetch(`${backendUrl}/api/ai/apply-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: 'Proxy failed', details: String(e?.message || e) });
  }
}
