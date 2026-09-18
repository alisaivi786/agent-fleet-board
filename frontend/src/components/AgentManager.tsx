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
import { CustomSelect } from './CustomSelect';

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
                  <CustomSelect
                    value={agent.projectId ?? ''}
                    onChange={(value) => handleAssignProject(agent.id, value)}
                    options={[
                      { value: '', label: 'No project' },
                      ...projects.map((project) => ({ value: project.id, label: project.name })),
                    ]}
                  />
                </td>
                <td>
                  <CustomSelect
                    value={agent.repoId ?? ''}
                    onChange={(value) => handleAssign(agent.id, value)}
                    options={[
                      { value: '', label: 'Unassigned' },
                      ...repos.map((repo) => ({ value: repo.id, label: repo.name })),
                    ]}
                  />
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
