import Head from 'next/head';
import Header from '../components/Header';

export default function TestRuns() {
  return (
    <>
      <Head>
        <title>Test Runs & Scheduling</title>
      </Head>
      <Header />
      <main className="container py-8">
        <h1 className="text-2xl font-bold mb-4">Test Runs & Scheduling</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6">
            <h3 className="font-semibold mb-3">New Test Run</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className="border px-3 py-2 rounded">
                <option>Select a project</option>
              </select>
              <select className="border px-3 py-2 rounded">
                <option>Select a test suite</option>
              </select>
            </div>

            <div className="mt-4">
              <div className="flex gap-2">
                <button className="px-3 py-2 bg-blue-600 text-white rounded">Run Now</button>
                <button className="px-3 py-2 border rounded">Schedule for Later</button>
                <button className="px-3 py-2 border rounded">Recurring</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <input className="border px-3 py-2 rounded" placeholder="mm/dd/yyyy" />
                <input className="border px-3 py-2 rounded" placeholder="--:-- --" />
              </div>

              <div className="mt-4 text-right">
                <button className="px-4 py-2 bg-blue-600 text-white rounded">Start Test Run</button>
              </div>
            </div>
          </div>

          <aside className="card p-6">
            <h3 className="font-semibold mb-3">Past Test Runs</h3>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex justify-between"><span>TR-2024-07-25-010</span><span className="text-green-600">Passed</span></li>
              <li className="flex justify-between"><span>TR-2024-07-25-009</span><span className="text-red-600">Failed</span></li>
              <li className="flex justify-between"><span>TR-2024-07-25-008</span><span className="text-green-600">Passed</span></li>
            </ul>
          </aside>
        </div>

        <section className="mt-6 card p-4">
          <h3 className="font-semibold mb-3">Ongoing Tests</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 text-xs">
              <tr><th>Test Run ID</th><th>Project</th><th>Status</th><th>Start Time</th><th>Duration</th></tr>
            </thead>
            <tbody>
              <tr className="border-t"><td>TR-2024-07-26-001</td><td>Project Alpha</td><td className="text-amber-500">Running</td><td>2024-07-26 10:00 AM</td><td>00:15:32</td></tr>
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
