'use client'
import { NextPage } from 'next';
import Link from 'next/link';
import Header from '../../components/Header';
import { useEffect, useState } from 'react';
import { listProjects, deleteProject } from '../../lib/api';
import { Trash2, Edit, Code, AlertTriangle, X } from 'lucide-react';
import styles from './projects.module.css';

type Project = {
  id: string;
  name: string;
  description?: string;
  tooling?: string[];
  languages?: string[];
  createdAt?: string;
  files?: { path: string; content: string }[];
};

const ProjectsPage: NextPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await listProjects();
      if (response.data) {
        setProjects(response.data);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setDeleting(projectId);
    try {
      const response = await deleteProject(projectId);
      if (response.data) {
        // Remove from local state
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setDeleteConfirm(null);
      } else {
        console.error('Failed to delete project:', response.error);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setDeleting(null);
    }
  };

  const confirmDelete = (projectId: string) => {
    setDeleteConfirm(projectId);
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className={styles.container}>
          <div className={styles.loading}>Loading projects...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className={styles.container}>
        <div className={styles.topRow}>
          <h1 className={styles.title}>Projects</h1>
          <Link href="/projects/create" className={styles.createBtn}>
            + Create Project
          </Link>
        </div>

        <div className={styles.grid}>
          {projects.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📁</div>
              <h3>No projects found</h3>
              <p>Create your first project to get started with automated testing.</p>
              <Link href="/projects/create" className={styles.createBtnSecondary}>
                Create Project
              </Link>
            </div>
          )}

          {projects.map((p) => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardActions}>
                  <Link 
                    href={`/ide?projectId=${encodeURIComponent(p.id)}`} 
                    className={styles.actionBtn + ' ' + styles.ideBtn}
                    title="Open IDE"
                  >
                    <Code size={16} />
                    IDE
                  </Link>
                  
                  <Link 
                    href={`/projects/${p.id}/edit`} 
                    className={styles.actionBtn + ' ' + styles.editBtn}
                    title="Edit Project"
                  >
                    <Edit size={16} />
                    Edit
                  </Link>
                  
                  <button
                    onClick={() => confirmDelete(p.id)}
                    className={styles.actionBtn + ' ' + styles.deleteBtn}
                    title="Delete Project"
                    disabled={deleting === p.id}
                  >
                    <Trash2 size={16} />
                    {deleting === p.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>

                <div className={styles.cardInfo}>
                  <div className={styles.cardTitle}>{p.name}</div>
                  {p.description ? (
                    <div className={styles.cardDesc}>{p.description}</div>
                  ) : (
                    <div className={styles.cardDescPlaceholder}>
                      {(p as any).frameworkType && (p as any).testSuite && (p as any).language 
                        ? `${(p as any).frameworkType} ${(p as any).testSuite} project using ${(p as any).language}`
                        : 'No description available'
                      }
                    </div>
                  )}
                  
                  {/* Test count and project stats */}
                  <div className={styles.projectStats}>
                    <div className={styles.statItem}>
                      <span className={styles.statIcon}>📁</span>
                      <span className={styles.statValue}>{(p.files ?? []).length}</span>
                      <span className={styles.statLabel}>files</span>
                    </div>
                    {(() => {
                      const testFiles = (p.files ?? []).filter(f => 
                        f.path.toLowerCase().includes('test') || 
                        f.path.toLowerCase().includes('spec') ||
                        f.path.toLowerCase().includes('.feature') ||
                        f.path.endsWith('.test.js') ||
                        f.path.endsWith('.test.ts') ||
                        f.path.endsWith('.spec.js') ||
                        f.path.endsWith('.spec.ts') ||
                        f.path.includes('/tests/') ||
                        f.path.includes('/test/')
                      );
                      return testFiles.length > 0 && (
                        <div className={styles.statItem}>
                          <span className={styles.statIcon}>🧪</span>
                          <span className={styles.statValue}>{testFiles.length}</span>
                          <span className={styles.statLabel}>tests</span>
                        </div>
                      );
                    })()}
                    <div className={styles.statItem}>
                      <span className={styles.statIcon}>📅</span>
                      <span className={styles.statValue}>
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Unknown'}
                      </span>
                      <span className={styles.statLabel}>created</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.cardContent}>
                {/* Project form details */}
                {((p as any).frameworkType || (p as any).testSuite || (p as any).language || ((p as any).tools && (p as any).tools.length > 0)) && (
                  <div className={styles.projectDetails}>
                    {(p as any).frameworkType && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Framework:</span>
                        <span className={styles.detailValue}>{(p as any).frameworkType}</span>
                      </div>
                    )}
                    {(p as any).testSuite && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Test Suite:</span>
                        <span className={styles.detailValue}>{(p as any).testSuite}</span>
                      </div>
                    )}
                    {(p as any).language && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Language:</span>
                        <span className={styles.detailValue}>{(p as any).language}</span>
                      </div>
                    )}
                    {(p as any).tools && (p as any).tools.length > 0 && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Tools:</span>
                        <span className={styles.detailValue}>{(p as any).tools.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.chips}>
                  {((p.tooling ?? []) as string[]).slice(0, 4).map((t) => (
                    <div key={t} className={styles.chip}>
                      {t}
                    </div>
                  ))}

                  {((p.languages ?? []) as string[]).slice(0, 4).map((l) => (
                    <div key={l} className={styles.chipAlt}>
                      {l}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.metaRow}>
                <div>{(p.files ?? []).length} tests</div>
                <div>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className={styles.modalOverlay} onClick={cancelDelete}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <AlertTriangle size={24} className={styles.warningIcon} />
                <h3>Delete Project</h3>
                <button onClick={cancelDelete} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.modalBody}>
                <p>
                  Are you sure you want to delete this project? This action will also remove:
                </p>
                <ul className={styles.deleteList}>
                  <li>All project files and code</li>
                  <li>All associated test runs</li>
                  <li>All revert history</li>
                </ul>
                <p className={styles.warningText}>
                  <strong>This action cannot be undone.</strong>
                </p>
              </div>
              
              <div className={styles.modalActions}>
                <button onClick={cancelDelete} className={styles.cancelBtn}>
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteProject(deleteConfirm)} 
                  className={styles.confirmDeleteBtn}
                  disabled={deleting === deleteConfirm}
                >
                  {deleting === deleteConfirm ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default ProjectsPage;
