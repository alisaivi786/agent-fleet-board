import { useState } from 'react';
import { createProject, deleteProject } from '../api';
import type { Project, RepoDefinition } from '../types';

const BRANCH_PRESETS = ['main', 'master', 'develop'];

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
  const [baseBranch, setBaseBranch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createProject({
        name,
        repoId: repoId || undefined,
        baseBranch: baseBranch.trim() || undefined,
      });
      setName('');
      setRepoId('');
      setBaseBranch('');
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

  const repoName = (id: string | null) => (id ? repos.find((r) => r.id === id)?.name ?? '—' : '—');

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
              <th>Default repo</th>
              <th>Base branch</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td className="mono-cell">{repoName(project.repoId)}</td>
                <td className="mono-cell">{project.baseBranch ?? '—'}</td>
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
        <select value={repoId} onChange={(e) => setRepoId(e.target.value)}>
          <option value="">No default repo</option>
          {repos.map((repo) => (
            <option value={repo.id} key={repo.id}>
              {repo.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Base branch (optional)"
          list="project-base-branch-presets"
          value={baseBranch}
          onChange={(e) => setBaseBranch(e.target.value)}
        />
        <datalist id="project-base-branch-presets">
          {BRANCH_PRESETS.map((preset) => (
            <option value={preset} key={preset} />
          ))}
        </datalist>
        <button type="submit" disabled={busy}>
          Create project
        </button>
      </form>
      <p className="hint-text">
        Default repo only pre-fills a new agent's repo when it doesn't have one yet - agents already assigned
        keep their own repo. Base branch is descriptive only; each agent's ahead/behind still comes from its own
        repo's base branch.
      </p>
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
