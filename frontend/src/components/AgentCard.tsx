import { useState } from 'react';
import type { AgentStatus, RepoDefinition } from '../types';
import { avatarColor } from '../colors';
import { assignAgent, unassignAgent } from '../api';
import { SessionPanel } from './SessionPanel';
import { StatusPill } from './StatusPill';

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function AgentCard({
  agent,
  repos,
  onChange,
}: {
  agent: AgentStatus;
  repos: RepoDefinition[];
  onChange: () => void;
}) {
  const initial = agent.name.charAt(0).toUpperCase();

  const [workOpen, setWorkOpen] = useState(false);
  const [reassignBusy, setReassignBusy] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  async function handleReassign(repoId: string) {
    setReassignBusy(true);
    setReassignError(null);
    try {
      if (repoId === '') {
        await unassignAgent(agent.id);
      } else {
        await assignAgent(agent.id, repoId);
      }
      onChange();
    } catch (err) {
      setReassignError(err instanceof Error ? err.message : 'Failed to update assignment');
    } finally {
      setReassignBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="avatar" style={{ background: avatarColor(agent.name) }}>
          {initial}
        </div>
        <div>
          <div className="card-name">{agent.name}</div>
          <div className="card-role">{agent.role}</div>
        </div>
        <StatusPill agent={agent} />
      </div>

      {agent.projectName && (
        <div className="project-chip-row">
          <span className="project-chip">{agent.projectName}</span>
        </div>
      )}

      <div className="assign-row">
        <span className="k">Repo</span>
        <select value={agent.repoId ?? ''} onChange={(e) => handleReassign(e.target.value)} disabled={reassignBusy}>
          <option value="">Unassigned</option>
          {repos.map((repo) => (
            <option value={repo.id} key={repo.id}>
              {repo.name}
            </option>
          ))}
        </select>
      </div>
      {reassignError && <div className="error-banner">{reassignError}</div>}

      {agent.error ? (
        <p className="card-error">{agent.error}</p>
      ) : (
        <div className="kv">
          <div className="kv-row">
            <span className="k">Branch</span>
            <span className="v">
              <span className="branch-chip">{agent.branch ?? '—'}</span>
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Last commit</span>
            <span className="v">{agent.lastCommitMessage ?? '—'}</span>
          </div>
          <div className="kv-row">
            <span className="k">Committed</span>
            <span className="v">{relativeTime(agent.lastCommitDate)}</span>
          </div>
          <div className="kv-row">
            <span className="k">vs. base</span>
            <span className="v">
              {agent.aheadOfBase} ahead · {agent.behindBase} behind
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Working tree</span>
            <span className="v">{agent.isClean ? 'clean' : `${agent.changedFiles.length} changed`}</span>
          </div>
        </div>
      )}

      {agent.repoPath && (
        <div className="worktree-path" title={agent.repoPath}>
          {agent.repoPath}
        </div>
      )}

      {agent.changedFiles.length > 0 && (
        <div className="swap-strip">
          {agent.changedFiles.slice(0, 6).map((file) => (
            <span className="tag" key={file}>
              {file}
            </span>
          ))}
          {agent.changedFiles.length > 6 && <span className="tag">+{agent.changedFiles.length - 6} more</span>}
        </div>
      )}

      <div className="card-actions">
        <button
          type="button"
          className="btn-primary work-toggle"
          onClick={() => setWorkOpen((open) => !open)}
          disabled={!agent.repoId}
          title={agent.repoId ? undefined : 'Assign a repo first'}
        >
          {workOpen ? 'Close' : 'Assign work'}
        </button>
      </div>

      {workOpen && <SessionPanel agentId={agent.id} repoName={agent.repoName} />}
    </div>
  );
}
