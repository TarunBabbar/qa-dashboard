import Link from 'next/link';
import { FaHome, FaFolderOpen, FaCode, FaPlayCircle, FaRobot } from 'react-icons/fa';

export default function Dashboard() {
  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon"><FaRobot /></span>
          <span className="brand-text">QA Dashboard</span>
        </div>
        <nav className="nav">
          <Link href="/dashboard" className="nav-link active"><FaHome className="icon" /> <span>Dashboard</span></Link>
          <Link href="/projects" className="nav-link"><FaFolderOpen className="icon" /> <span>Projects</span></Link>
          <Link href="/ide" className="nav-link"><FaCode className="icon" /> <span>IDE</span></Link>
          <Link href="/testruns" className="nav-link"><FaPlayCircle className="icon" /> <span>Test Runs</span></Link>
          <Link href="/ai-assistant" className="nav-link"><FaRobot className="icon" /> <span>AI Assistant</span></Link>
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <div className="status">Online</div>
          </div>
          <div className="profile">
            <div className="avatar"><FaRobot /></div>
            <div className="username">John Doe</div>
          </div>
        </div>

        <section className="metrics">
          <div className="metric-card">
            <div className="metric-label">Total Projects</div>
            <div className="metric-value">0</div>
            <div className="metric-icon"><FaFolderOpen /></div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Active Tests</div>
            <div className="metric-value">0</div>
            <div className="metric-icon"><FaPlayCircle /></div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Success Rate</div>
            <div className="metric-value">0%</div>
            <div className="metric-icon">✓</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Last Run</div>
            <div className="metric-value">2m ago</div>
            <div className="metric-icon">⏲</div>
          </div>
        </section>

        <section className="panels">
          <div className="panel">
            <h3>Recent Projects</h3>
            <p className="muted">No projects yet</p>
          </div>
          <div className="panel">
            <h3>Test Results Overview</h3>
            <p className="muted">No test results yet</p>
          </div>
        </section>
      </main>
    </div>
  );
}
