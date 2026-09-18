import type { AgentStatus, RepoDefinition, SessionActivity } from '../types';
import { avatarColor } from '../colors';
import { forceStopSession } from '../api';
import { StatusPill } from '../components/StatusPill';
import { ActivityFeed } from '../components/ActivityFeed';
import { SystemHealthPanel } from '../components/SystemHealthPanel';
import type { Tab } from '../components/Sidebar';

export function DashboardPage({
  agents,
  repos,
  activity,
  onChange,
  onNavigate,
}: {
  agents: AgentStatus[];
  repos: RepoDefinition[];
  activity: SessionActivity[];
  onChange: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  const runningTasks = activity.filter((a) => a.status === 'Running').length;
  const failedTasks = activity.filter((a) => a.status === 'Failed').length;
  const runningSessionByAgentId = new Map(activity.filter((a) => a.status === 'Running').map((a) => [a.agentId, a.id]));

  // "Active" here means "has an actual running session" - matches Running tasks above. This is
  // deliberately NOT the git-derived Diverged/Idle status shown on the Agents page: an agent can
  // be git-clean (no divergence) while a session is genuinely running, or git-diverged with
  // nothing running at all. Conflating the two previously made a stuck session invisible here.
  const activeAgents = agents.filter((a) => runningSessionByAgentId.has(a.id));
  const idleAgents = agents.filter((a) => !runningSessionByAgentId.has(a.id));

  async function handleStop(agentId: string) {
    const sessionId = runningSessionByAgentId.get(agentId);
    if (!sessionId) return;
    await forceStopSession(sessionId);
    onChange();
  }

  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          <div className="num">{repos.length}</div>
          <div className="label">Total repositories</div>
        </div>
        <div className="stat">
          <div className="num">{activeAgents.length}</div>
          <div className="label">Active agents</div>
        </div>
        <div className="stat">
          <div className="num">{idleAgents.length}</div>
          <div className="label">Idle agents</div>
        </div>
        <div className="stat">
          <div className="num">{runningTasks}</div>
          <div className="label">Running tasks</div>
        </div>
        <div className="stat">
          <div className="num">{failedTasks}</div>
          <div className="label">Failed tasks</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel dashboard-repos">
          <div className="panel-head">
            <span className="panel-title">Repositories</span>
            <button type="button" className="panel-link" onClick={() => onNavigate('repositories')}>
              View all →
            </button>
          </div>
          {repos.length === 0 ? (
            <p className="loading">No repos registered yet.</p>
          ) : (
            <table className="manage-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Base branch</th>
                  <th>Agents</th>
                  <th>Projects</th>
                </tr>
              </thead>
              <tbody>
                {repos.slice(0, 6).map((repo) => {
                  const repoAgents = agents.filter((a) => a.repoId === repo.id);
                  // Derived from the agents actually on this repo, not Project.RepoId - see
                  // RepositoriesPage.tsx and CLAUDE.md for why that field isn't authoritative.
                  const repoProjectCount = new Set(repoAgents.map((a) => a.projectName).filter(Boolean)).size;
                  return (
                    <tr key={repo.id}>
                      <td>{repo.name}</td>
                      <td className="mono-cell">{repo.baseBranch}</td>
                      <td>{repoAgents.length}</td>
                      <td>{repoProjectCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <SystemHealthPanel agents={agents} />

        <div className="panel dashboard-activity">
          <div className="panel-head">
            <span className="panel-title">Activity Log</span>
            <button type="button" className="panel-link" onClick={() => onNavigate('activity')}>
              View all →
            </button>
          </div>
          <ActivityFeed activity={activity} limit={8} />
        </div>
      </div>

      <div className="dashboard-agents-grid">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Active agents</span>
            <button type="button" className="panel-link" onClick={() => onNavigate('agents')}>
              View all →
            </button>
          </div>
          {activeAgents.length === 0 ? (
            <p className="loading">No agents have a running session right now.</p>
          ) : (
            <div className="mini-agent-list">
              {activeAgents.map((agent) => (
                <div className="mini-agent-row" key={agent.id}>
                  <span className="avatar avatar-sm" style={{ background: avatarColor(agent.name) }}>
                    {agent.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="project-agent-info">
                    <div className="project-agent-name">{agent.name}</div>
                    <div className="card-role">{agent.repoName ?? 'No repo'}</div>
                  </div>
                  <StatusPill agent={agent} running />
                  <button type="button" className="btn-danger" onClick={() => handleStop(agent.id)}>
                    Stop
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Idle agents</span>
            <span className="pill idle">
              <span className="dot" />
              {idleAgents.length}
            </span>
          </div>
          {idleAgents.length === 0 ? (
            <p className="loading">No idle agents.</p>
          ) : (
            <div className="mini-agent-list">
              {idleAgents.map((agent) => (
                <div className="mini-agent-row" key={agent.id}>
                  <span className="avatar avatar-sm" style={{ background: avatarColor(agent.name) }}>
                    {agent.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="project-agent-info">
                    <div className="project-agent-name">{agent.name}</div>
                    <div className="card-role">{agent.repoName ?? 'No repo assigned'}</div>
                  </div>
                  <StatusPill agent={agent} />
                  <button type="button" className="btn-secondary" onClick={() => onNavigate('agents')}>
                    Assign work
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
