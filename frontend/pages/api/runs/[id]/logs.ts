import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query as { id: string };
  if (!id) return res.status(400).json({ error: 'Run id required' });

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
  try {
    const resp = await fetch(`${backendUrl}/api/runs/${encodeURIComponent(id)}/logs`);
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch run logs', details: String(e?.message || e) });
  }
}

