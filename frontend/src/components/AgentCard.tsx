import { useEffect, useState } from 'react';
import type { AgentSession, AgentStatus, RepoDefinition } from '../types';
import { avatarColor } from '../colors';
import { assignAgent, fetchSessions, forceStopSession, unassignAgent } from '../api';
import { SessionPanel } from './SessionPanel';
import { StatusPill } from './StatusPill';
import { AgentHistoryModal } from './AgentHistoryModal';
import { CustomSelect } from './CustomSelect';

function relativeTime(iso: string | null): string {
  if (!iso) return '-';
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reassignBusy, setReassignBusy] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [runningSession, setRunningSession] = useState<AgentSession | null>(null);
  const [stopBusy, setStopBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const sessions = await fetchSessions(agent.id, controller.signal);
        const latest = sessions[0];
        if (latest?.status === 'Running') {
          setRunningSession(latest);
        }
      } catch {
        // Best effort - the card just won't show a running-session badge if this fails.
      }
    })();
    return () => controller.abort();
    // Only re-check when the agent identity changes - this is a point-in-time check, not a live
    // poll, so a session started from elsewhere while this card is on screen won't appear until
    // the next full page load. Open "Assign work" for a live-polled view of a specific session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

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

  async function handleStopRunningSession() {
    if (!runningSession) return;
    setStopBusy(true);
    try {
      await forceStopSession(runningSession.id);
      setRunningSession(null);
    } catch (err) {
      setReassignError(err instanceof Error ? err.message : 'Failed to stop session');
    } finally {
      setStopBusy(false);
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
        <StatusPill agent={agent} running={!!runningSession} />
      </div>

      {agent.projectName && (
        <div className="project-chip-row">
          <span className="project-chip">{agent.projectName}</span>
        </div>
      )}

      {runningSession && (
        <div className="running-session-banner">
          <span className="pill working">
            <span className="dot" />
            Session running
          </span>
          <button type="button" className="btn-danger" onClick={handleStopRunningSession} disabled={stopBusy}>
            Stop
          </button>
        </div>
      )}

      <div className="assign-row">
        <span className="k">Repo</span>
        <CustomSelect
          value={agent.repoId ?? ''}
          onChange={handleReassign}
          disabled={reassignBusy}
          options={[{ value: '', label: 'Unassigned' }, ...repos.map((repo) => ({ value: repo.id, label: repo.name }))]}
        />
      </div>
      {reassignError && <div className="error-banner">{reassignError}</div>}

      {agent.error ? (
        <p className="card-error">{agent.error}</p>
      ) : (
        <div className="kv">
          <div className="kv-row">
            <span className="k">Branch</span>
            <span className="v">
              <span className="branch-chip">{agent.branch ?? '-'}</span>
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Last commit</span>
            <span className="v">{agent.lastCommitMessage ?? '-'}</span>
          </div>
          <div className="kv-row">
            <span className="k">Committed</span>
            <span className="v">{relativeTime(agent.lastCommitDate)}</span>
          </div>
          <div className="kv-row">
            <span className="k">vs. base</span>
            <span className="v">
              {agent.aheadOfBase} ahead / {agent.behindBase} behind
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
        <button type="button" className="btn-secondary" onClick={() => setHistoryOpen(true)}>
          History
        </button>
      </div>

      {workOpen && <SessionPanel agentId={agent.id} repoName={agent.repoName} />}
      {historyOpen && (
        <AgentHistoryModal agentId={agent.id} agentName={agent.name} onClose={() => setHistoryOpen(false)} />
      )}
    </div>
  );
}
