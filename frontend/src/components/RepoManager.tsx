import { useState } from 'react';
import { createRepo, deleteRepo, discoverWorktrees } from '../api';
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
  const [discoverBusyId, setDiscoverBusyId] = useState<string | null>(null);
  const [discoverMessage, setDiscoverMessage] = useState<string | null>(null);

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

  async function handleDiscover(id: string) {
    setDiscoverBusyId(id);
    setError(null);
    setDiscoverMessage(null);
    try {
      const result = await discoverWorktrees(id);
      setDiscoverMessage(
        result.createdAgents.length === 0
          ? 'No new worktrees found - everything already registered.'
          : `Registered ${result.createdAgents.length} new agent(s): ${result.createdAgents.map((a) => a.name).join(', ')}.`,
      );
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover worktrees');
    } finally {
      setDiscoverBusyId(null);
    }
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
                <td className="manage-table-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleDiscover(repo.id)}
                    disabled={discoverBusyId === repo.id}
                    title="Scan this repo for git worktrees (e.g. .claude/worktrees/*) and register a repo+agent for each new one found"
                  >
                    {discoverBusyId === repo.id ? 'Scanning…' : 'Discover worktrees'}
                  </button>
                  <button type="button" className="btn-danger" onClick={() => handleDelete(repo.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {discoverMessage && <p className="hint-text">{discoverMessage}</p>}

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
