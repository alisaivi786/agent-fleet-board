import { useState } from 'react';
import type { CSSProperties } from 'react';
import { avatarColor } from '../colors';
import { isWorking } from '../agentStatus';
import { CustomSelect } from '../components/CustomSelect';
import { CloseIcon } from '../icons';
import type { AgentStatus, Project, SessionActivity } from '../types';

const DISMISSED_FAILURES_KEY = 'afb-agent-map-dismissed-failures';

function latestSessionByAgent(activity: SessionActivity[]): Map<string, SessionActivity> {
  const sessions = new Map<string, SessionActivity>();
  for (const entry of activity) {
    if (!sessions.has(entry.agentId)) {
      sessions.set(entry.agentId, entry);
    }
  }
  return sessions;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'no session';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function compactPath(path: string | null): string {
  if (!path) return 'No repo';
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return path;
  return `${parts.at(-2)} / ${parts.at(-1)}`;
}

function mapState(agent: AgentStatus, session: SessionActivity | undefined): 'running' | 'failed' | 'working' | 'idle' {
  if (session?.status === 'Running') return 'running';
  if (isWorking(agent)) return 'working';
  if (session?.status === 'Failed' || agent.error) return 'failed';
  return 'idle';
}

function stateLabel(state: ReturnType<typeof mapState>, session: SessionActivity | undefined): string {
  if (state === 'running') return 'running now';
  if (state === 'failed') return 'needs attention';
  if (state === 'working') return 'work in progress';
  return session ? `${session.status.toLowerCase()} ${relativeTime(session.endedAtUtc ?? session.startedAtUtc)}` : 'ready';
}

function failureTitle(summary: string | null | undefined): string {
  const text = summary?.toLowerCase() ?? '';
  if (text.includes('session limit')) return 'Claude session limit reached';
  if (text.includes('workspace has not been trusted') || text.includes('trust dialog')) return 'Workspace trust required';
  return 'Request failed';
}

function compactFailure(summary: string | null | undefined): string {
  if (!summary) return 'No failure output was captured. Open Activity to inspect the full session log.';
  return summary.length <= 320 ? summary : `${summary.slice(0, 320)}...`;
}

function loadDismissedFailures(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISSED_FAILURES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveDismissedFailures(ids: string[]) {
  try {
    localStorage.setItem(DISMISSED_FAILURES_KEY, JSON.stringify(ids));
  } catch {
    // Best effort only - dismissal still works for this render.
  }
}

function AgentNode({
  agent,
  session,
  index,
}: {
  agent: AgentStatus;
  session: SessionActivity | undefined;
  index: number;
}) {
  const state = mapState(agent, session);
  const active = state === 'running' || state === 'working';
  const changedLabel = agent.isClean ? 'clean' : `${agent.changedFiles.length} files`;

  return (
    <div className={`agent-map-orbit-agent ${state}`} style={{ '--agent-index': index } as CSSProperties}>
      <div className="agent-map-connector" aria-hidden="true">
        <span />
      </div>

      <article className="agent-map-person">
        {active && (
          <div className="agent-map-live-ribbon">
            <span />
            {state === 'running' ? 'Live run' : 'Active work'}
          </div>
        )}
        <div className="agent-map-scan" aria-hidden="true" />
        <div className="agent-map-person-head">
          <span className="avatar avatar-sm" style={{ background: avatarColor(agent.name) }}>
            {agent.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{agent.name}</strong>
            <span>{agent.role}</span>
          </div>
          <em>{stateLabel(state, session)}</em>
        </div>

        <div className="agent-map-person-meta">
          <span title={agent.repoPath ?? undefined}>{compactPath(agent.repoPath)}</span>
          <span>{agent.branch ?? 'no branch'}</span>
          <span>{changedLabel}</span>
        </div>

        {active && (
          <div className="agent-map-run-console">
            <strong>{state === 'running' ? 'Execution in progress' : 'Work branch active'}</strong>
            <span>{agent.branch ?? 'tracking workspace'}</span>
            <div aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        )}

        <div className="agent-map-file-shuffle" aria-hidden="true" data-active={active}>
          <i />
          <i />
          <i />
          <i />
        </div>

        {state === 'failed' && (
          <div className="agent-map-failure-alert">
            <strong>{failureTitle(session?.failureSummary)}</strong>
            <span>{compactFailure(session?.failureSummary)}</span>
          </div>
        )}
      </article>
    </div>
  );
}

export function AgentMapPage({
  projects,
  agents,
  activity,
}: {
  projects: Project[];
  agents: AgentStatus[];
  activity: SessionActivity[];
}) {
  const [projectFilter, setProjectFilter] = useState('all');
  const [dismissedFailureIds, setDismissedFailureIds] = useState<string[]>(loadDismissedFailures);
  const sessions = latestSessionByAgent(activity);
  const unassignedAgents = agents.filter((agent) => !agent.projectId);
  const allGroups = [
    ...projects.map((project) => ({
      id: project.id,
      name: project.name,
      detail: project.baseBranch ? `base ${project.baseBranch}` : 'project',
      agents: agents.filter((agent) => agent.projectId === project.id),
    })),
    ...(unassignedAgents.length > 0
      ? [{ id: 'unassigned', name: 'Unassigned', detail: 'no project', agents: unassignedAgents }]
      : []),
  ];
  const groups = projectFilter === 'all' ? allGroups : allGroups.filter((group) => group.id === projectFilter);

  const runningCount = activity.filter((entry) => entry.status === 'Running').length;
  const workingCount = agents.filter((agent) => isWorking(agent)).length;
  const failedRequests = activity.filter(
    (entry) => entry.status === 'Failed' && !dismissedFailureIds.includes(entry.id),
  );
  const filterOptions = [
    { value: 'all', label: 'All projects' },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
    ...(unassignedAgents.length > 0 ? [{ value: 'unassigned', label: 'Unassigned agents' }] : []),
  ];

  function dismissFailures() {
    const next = [...new Set([...dismissedFailureIds, ...failedRequests.map((entry) => entry.id)])];
    setDismissedFailureIds(next);
    saveDismissedFailures(next);
  }

  return (
    <div className="agent-map-page">
      <div className="agent-map-banner">
        <div>
          <p className="section-label">Agent Map</p>
          <h2>Project edges and parallel agents</h2>
          <p>Each project is a hub. Connected agents show their repo, branch, working tree, and live motion when work is active.</p>
        </div>
        <div className="agent-map-banner-stats">
          <div>
            <span>Projects</span>
            <strong>{projects.length}</strong>
          </div>
          <div>
            <span>Agents</span>
            <strong>{agents.length}</strong>
          </div>
          <div>
            <span>Moving</span>
            <strong>{runningCount + workingCount}</strong>
          </div>
        </div>
      </div>

      <div className="agent-map-toolbar">
        <div>
          <span className="panel-title">Map filter</span>
          <p>Focus a single project when the fleet gets large.</p>
        </div>
        <CustomSelect
          className="agent-map-filter"
          value={projectFilter}
          onChange={setProjectFilter}
          options={filterOptions}
        />
      </div>

      {failedRequests.length > 0 && (
        <div className="agent-map-global-alert">
          <div>
            <strong>{failureTitle(failedRequests[0].failureSummary)}</strong>
            <span>
              {failedRequests.length} failed request{failedRequests.length === 1 ? '' : 's'} need attention.
            </span>
          </div>
          <p>{compactFailure(failedRequests[0].failureSummary)}</p>
          <button type="button" className="agent-map-alert-close" onClick={dismissFailures} title="Dismiss alert">
            <CloseIcon />
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="loading">No projects or agents to map yet.</p>
      ) : (
        <div className="agent-map-canvas">
          {groups.map((group) => (
            <section className="agent-map-cluster" key={group.id}>
              <div className="agent-map-cluster-field">
                <div className="agent-map-project-node">
                  <span className="project-map-orbit" />
                  <span className="project-map-orbit orbit-two" />
                  <strong>{group.name}</strong>
                  <em>{group.detail}</em>
                  <small>
                    {group.agents.length} agent{group.agents.length === 1 ? '' : 's'}
                  </small>
                </div>

                <div className="agent-map-legend-line" aria-hidden="true" />

                <div className="agent-map-constellation">
                  {group.agents.length === 0 ? (
                    <div className="agent-map-empty">No agents connected.</div>
                  ) : (
                    group.agents.map((agent, index) => (
                      <AgentNode
                        agent={agent}
                        session={sessions.get(agent.id)}
                        index={index}
                        key={agent.id}
                      />
                    ))
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
