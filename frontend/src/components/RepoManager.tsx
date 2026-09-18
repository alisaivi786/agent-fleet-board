import { useState } from 'react';
import { createRepo, deleteRepo } from '../api';
import type { RepoDefinition } from '../types';

export function RepoManager({
  repos,
  onChange,
}: {
  repos: RepoDefinition[];
  onChange: () => void;
}) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [baseBranch, setBaseBranch] = useState('main');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createRepo({ name, path, baseBranch });
      setName('');
      setPath('');
      setBaseBranch('main');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repo');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteRepo(id);
    onChange();
  }

  return (
    <div className="manage-section">
      <p className="section-label">Repos</p>

      {repos.length === 0 ? (
        <p className="loading">No repos registered yet.</p>
      ) : (
        <table className="manage-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Path</th>
              <th>Base branch</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {repos.map((repo) => (
              <tr key={repo.id}>
                <td>{repo.name}</td>
                <td className="mono-cell">{repo.path}</td>
                <td>{repo.baseBranch}</td>
                <td>
                  <button type="button" className="btn-danger" onClick={() => handleDelete(repo.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="manage-form" onSubmit={handleSubmit}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          placeholder="Path (e.g. C:\path\to\repo)"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          required
        />
        <input
          placeholder="Base branch"
          value={baseBranch}
          onChange={(e) => setBaseBranch(e.target.value)}
          required
        />
        <button type="submit" disabled={busy}>
          Add repo
        </button>
      </form>
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
