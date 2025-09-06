import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
  const url = `${backendUrl}/api/runs`;
  try {
    if (req.method === 'GET') {
      const resp = await fetch(url);
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }
    if (req.method === 'POST') {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to proxy runs', details: String(e?.message || e) });
  }
}
