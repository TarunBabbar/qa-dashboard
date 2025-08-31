import Head from 'next/head';
import Header from '../components/Header';

export default function Reports() {
  return (
    <>
      <Head>
        <title>Test Reports & Analytics</title>
      </Head>
      <Header />

      <main className="container py-8">
        <h1 className="text-2xl font-bold mb-4">Test Reports & Analytics</h1>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-sm text-slate-500">Total Tests Executed</div>
            <div className="text-2xl font-bold">1,250</div>
            <div className="text-green-500 text-sm">+10%</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-slate-500">Overall Pass Rate</div>
            <div className="text-2xl font-bold">92%</div>
            <div className="text-red-500 text-sm">-2%</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-slate-500">Average Execution Time</div>
            <div className="text-2xl font-bold">15s</div>
            <div className="text-green-500 text-sm">+5%</div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 card p-4">
            <h3 className="font-semibold mb-3">Execution Trends</h3>
            <div className="h-48 bg-slate-100/50 rounded"></div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold mb-3">Test Distribution by Type</h3>
            <div className="space-y-3 text-sm text-slate-700">
              <div>Unit <div className="h-2 bg-slate-200 rounded mt-1"><div className="h-2 bg-cyan-500 rounded" style={{width: '40%'}} /></div></div>
              <div>Integration <div className="h-2 bg-slate-200 rounded mt-1"><div className="h-2 bg-slate-600 rounded" style={{width: '25%'}} /></div></div>
              <div>UI <div className="h-2 bg-slate-200 rounded mt-1"><div className="h-2 bg-pink-500 rounded" style={{width: '20%'}} /></div></div>
            </div>
          </div>
        </section>

        <section className="mt-6 card p-4">
          <h3 className="font-semibold mb-3">Recent Test Runs</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 text-xs"><tr><th>Project</th><th>Test Suite</th><th>Status</th><th>Start Time</th><th>Duration</th></tr></thead>
            <tbody>
              <tr className="border-t"><td>Project Alpha</td><td>Regression Suite</td><td className="text-green-600">Passed</td><td>2024-07-26 10:00 AM</td><td>20m</td></tr>
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
