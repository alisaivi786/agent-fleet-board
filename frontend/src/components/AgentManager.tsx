import { useState } from 'react';
import {
  assignAgent,
  assignAgentProject,
  createAgent,
  deleteAgent,
  unassignAgent,
  unassignAgentProject,
} from '../api';
import type { AgentStatus, Project, RepoDefinition } from '../types';

export function AgentManager({
  agents,
  repos,
  projects,
  onChange,
}: {
  agents: AgentStatus[];
  repos: RepoDefinition[];
  projects: Project[];
  onChange: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createAgent({ name, role });
      setName('');
      setRole('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(agentId: string, repoId: string) {
    setError(null);
    try {
      if (repoId === '') {
        await unassignAgent(agentId);
      } else {
        await assignAgent(agentId, repoId);
      }
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update assignment');
    }
  }

  async function handleDelete(id: string) {
    await deleteAgent(id);
    onChange();
  }

  async function handleAssignProject(agentId: string, projectId: string) {
    setError(null);
    try {
      if (projectId === '') {
        await unassignAgentProject(agentId);
      } else {
        await assignAgentProject(agentId, projectId);
      }
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project assignment');
    }
  }

  return (
    <div className="manage-section">
      <p className="section-label">Agents</p>

      {agents.length === 0 ? (
        <p className="loading">No agents created yet.</p>
      ) : (
        <table className="manage-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Project</th>
              <th>Assigned repo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td>{agent.name}</td>
                <td>{agent.role}</td>
                <td>
                  <select value={agent.projectId ?? ''} onChange={(e) => handleAssignProject(agent.id, e.target.value)}>
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option value={project.id} key={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={agent.repoId ?? ''}
                    onChange={(e) => handleAssign(agent.id, e.target.value)}
                    disabled={!!agent.projectId}
                    title={agent.projectId ? 'Bound to project repo - unassign the project first' : undefined}
                  >
                    <option value="">Unassigned</option>
                    {repos.map((repo) => (
                      <option value={repo.id} key={repo.id}>
                        {repo.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button type="button" className="btn-danger" onClick={() => handleDelete(agent.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="manage-form" onSubmit={handleSubmit}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} required />
        <button type="submit" disabled={busy}>
          Create agent
        </button>
      </form>
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
