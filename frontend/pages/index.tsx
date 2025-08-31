import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import { useEffect, useState } from 'react';
import { getPassRateTrend } from '../lib/api';
import { PassRatePoint } from '../lib/types';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

// small UI helpers used only on this page for table pills and pass bars
function StatusPill({ status }: { status: 'Completed' | 'Failed' | 'Running' }) {
  const color = status === 'Completed' ? 'bg-green-100 text-green-700' : status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
  return (
    <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${color}`}>{status}</span>
  );
}

function PassBar({ pct }: { pct: number }) {
  const barColor = pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
        <div className={`${barColor} h-2`} style={{ width: pct + '%' }} />
      </div>
      <div className="text-sm text-slate-700 w-12 text-right font-medium">{pct}%</div>
    </div>
  );
}

const Home: NextPage = () => {
  const [trend, setTrend] = useState<PassRatePoint[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingTrend(true);
    getPassRateTrend('30d').then(r => {
      if (mounted && r.data) setTrend(r.data);
    }).finally(() => setLoadingTrend(false));
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <Head>
        <title>QA Dashboard</title>
      </Head>
      <Header />
      <main className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Overview</h1>
            <p className="text-slate-500">High-level summary of all test projects.</p>
          </div>
          <div className="hidden">{/* removed New Project button per design */}</div>
        </div>

        <div className="mb-6">
          <div className="flex gap-3 items-center">
            <select className="border rounded px-3 py-2">
              <option>All Projects</option>
            </select>
            <select className="border rounded px-3 py-2">
              <option>All Frameworks</option>
            </select>
            <select className="border rounded px-3 py-2">
              <option>All Statuses</option>
            </select>
            <button className="ml-2 px-3 py-2 border rounded">Apply</button>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-5">
            <div className="text-slate-500">Total Projects</div>
            <div className="text-2xl font-bold">15</div>
          </div>
          <div className="card p-5">
            <div className="text-slate-500">Total Test Runs</div>
            <div className="text-2xl font-bold">235</div>
          </div>
          <div className="card p-5">
            <div className="text-slate-500">Overall Pass Rate</div>
            <div className="text-2xl font-bold text-green-600">88%</div>
          </div>
        </section>

        <section className="card p-4 mb-6">
          <h3 className="font-semibold mb-3">Recent Test Runs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 text-sm">
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Test Suite</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Pass Rate</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Started At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { project: 'Project Alpha', suite: 'Regression Suite', status: 'Completed', pct: 95, duration: '2h 30m', started: '2024-01-15 10:00 AM' },
                  { project: 'Project Beta', suite: 'Smoke Test', status: 'Failed', pct: 75, duration: '1h 15m', started: '2024-01-14 03:45 PM' },
                  { project: 'Project Gamma', suite: 'Performance Test', status: 'Completed', pct: 100, duration: '3h 00m', started: '2024-01-13 09:00 AM' },
                  { project: 'Project Delta', suite: 'Integration Suite', status: 'Completed', pct: 85, duration: '2h 45m', started: '2024-01-12 11:30 AM' },
                  { project: 'Project Epsilon', suite: 'UI Test', status: 'Failed', pct: 60, duration: '1h 00m', started: '2024-01-11 02:15 PM' }
                ].map((r) => (
                  <tr key={r.project} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-800">{r.project}</td>
                    <td className="py-3 px-4 text-slate-700">{r.suite}</td>
                    <td className="py-3 px-4"><StatusPill status={r.status as any} /></td>
                    <td className="py-3 px-4"><PassBar pct={r.pct} /></td>
                    <td className="py-3 px-4 text-slate-700 tabular-nums">{r.duration}</td>
                    <td className="py-3 px-4 text-slate-600">{r.started}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4">
            <h4 className="font-semibold mb-2">Project Pass Rates</h4>
            <div className="text-slate-500 text-sm mb-3">85% <span className="text-green-500">+5%</span> vs. last 30 days</div>
            <div className="space-y-4 mt-2">
              {[{ name: 'Project Alpha', pct: 80 }, { name: 'Project Beta', pct: 90 }, { name: 'Project Gamma', pct: 20 }, { name: 'Project Delta', pct: 50 }, { name: 'Project Epsilon', pct: 90 }].map(p => (
                <div key={p.name}>
                  <div className="flex justify-between text-sm text-slate-600 mb-1"><span>{p.name}</span><span className="font-medium text-slate-800">{p.pct}%</span></div>
                  <div className="h-2 bg-slate-100 rounded overflow-hidden"><div className="h-2 bg-blue-600 rounded" style={{ width: p.pct + '%' }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h4 className="font-semibold mb-2">Test Run Trends</h4>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="text-2xl font-bold">235 <span className="ml-2 text-sm text-green-500 font-medium">+10%</span></div>
                <div className="text-sm text-slate-500">vs. last 30 days</div>
              </div>
              <div className="text-sm text-slate-400">&nbsp;</div>
            </div>
            <div className="h-36 flex items-end text-xs text-slate-400">
              <div className="w-full">
                <div className="h-24 bg-slate-50 rounded border border-dashed border-slate-100 flex items-end justify-between px-6 py-2">
                  <div className="text-center w-1/5">Week 1</div>
                  <div className="text-center w-1/5">Week 2</div>
                  <div className="text-center w-1/5">Week 3</div>
                  <div className="text-center w-1/5">Week 4</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default Home;