import type { AgentStatus, Project, RepoDefinition, SessionActivity } from '../types';
import { isIdle, isWorking } from '../agentStatus';
import { avatarColor } from '../colors';
import { forceStopSession } from '../api';
import { StatusPill } from '../components/StatusPill';
import { ActivityFeed } from '../components/ActivityFeed';
import { SystemHealthPanel } from '../components/SystemHealthPanel';
import type { Tab } from '../components/Sidebar';

export function DashboardPage({
  agents,
  repos,
  projects,
  activity,
  onChange,
  onNavigate,
}: {
  agents: AgentStatus[];
  repos: RepoDefinition[];
  projects: Project[];
  activity: SessionActivity[];
  onChange: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  const idleAgents = agents.filter(isIdle);
  const workingAgents = agents.filter(isWorking);
  const runningTasks = activity.filter((a) => a.status === 'Running').length;
  const failedTasks = activity.filter((a) => a.status === 'Failed').length;
  const runningSessionByAgentId = new Map(activity.filter((a) => a.status === 'Running').map((a) => [a.agentId, a.id]));

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
          <div className="num">{workingAgents.length}</div>
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
                {repos.slice(0, 6).map((repo) => (
                  <tr key={repo.id}>
                    <td>{repo.name}</td>
                    <td className="mono-cell">{repo.baseBranch}</td>
                    <td>{agents.filter((a) => a.repoId === repo.id).length}</td>
                    <td>{projects.filter((p) => p.repoId === repo.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <SystemHealthPanel />

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
          {workingAgents.length === 0 ? (
            <p className="loading">No agents are currently working.</p>
          ) : (
            <div className="mini-agent-list">
              {workingAgents.map((agent) => (
                <div className="mini-agent-row" key={agent.id}>
                  <span className="avatar avatar-sm" style={{ background: avatarColor(agent.name) }}>
                    {agent.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="project-agent-info">
                    <div className="project-agent-name">{agent.name}</div>
                    <div className="card-role">{agent.repoName ?? 'No repo'}</div>
                  </div>
                  <StatusPill agent={agent} />
                  {runningSessionByAgentId.has(agent.id) && (
                    <button type="button" className="btn-danger" onClick={() => handleStop(agent.id)}>
                      Stop
                    </button>
                  )}
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
