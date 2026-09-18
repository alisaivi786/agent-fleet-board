import { useState } from 'react';
import { createProject, deleteProject } from '../api';
import type { Project, RepoDefinition } from '../types';

export function ProjectManager({
  projects,
  repos,
  onChange,
}: {
  projects: Project[];
  repos: RepoDefinition[];
  onChange: () => void;
}) {
  const [name, setName] = useState('');
  const [repoId, setRepoId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createProject({ name, repoId });
      setName('');
      setRepoId('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    onChange();
  }

  const repoName = (id: string) => repos.find((r) => r.id === id)?.name ?? '—';

  return (
    <div className="manage-section">
      <p className="section-label">Projects</p>

      {projects.length === 0 ? (
        <p className="loading">No projects created yet.</p>
      ) : (
        <table className="manage-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Bound repo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td className="mono-cell">{repoName(project.repoId)}</td>
                <td>
                  <button type="button" className="btn-danger" onClick={() => handleDelete(project.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="manage-form" onSubmit={handleSubmit}>
        <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={repoId} onChange={(e) => setRepoId(e.target.value)} required>
          <option value="" disabled>
            Select a repo…
          </option>
          {repos.map((repo) => (
            <option value={repo.id} key={repo.id}>
              {repo.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy || !repoId}>
          Create project
        </button>
      </form>
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
