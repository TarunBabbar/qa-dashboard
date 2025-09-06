import type { NextApiRequest, NextApiResponse } from 'next';

// Returns logs for the most recent running run, or latest run if none running
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
  try {
    const runsResp = await fetch(`${backendUrl}/api/runs`);
    const runsJson = await runsResp.json();
    const runs = (runsJson?.runs ?? []) as Array<any>;
    if (!Array.isArray(runs) || runs.length === 0) {
      return res.status(200).json({ logs: '' });
    }

    const running = runs.find((r: any) => r.status === 'running');
    const target = running || runs.sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
    if (!target?.id) return res.status(200).json({ logs: '' });

    const logsResp = await fetch(`${backendUrl}/api/runs/${encodeURIComponent(target.id)}/logs`);
    const logsJson = await logsResp.json();
    return res.status(200).json({ logs: logsJson?.logs ?? '', runId: target.id, status: target.status });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch live logs', details: String(e?.message || e) });
  }
}
