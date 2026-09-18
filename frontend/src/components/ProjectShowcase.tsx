import type { AgentStatus, Project, SessionActivity } from '../types';
import { avatarColor } from '../colors';
import { StatusPill } from './StatusPill';
import { isIdle, isWorking } from '../agentStatus';

function compactPath(path: string | null): string {
  if (!path) return 'No repo path';
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 3) return path;
  return `${parts.at(-3)} / ${parts.at(-2)} / ${parts.at(-1)}`;
}

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

function sessionStatusClass(status: SessionActivity['status'] | null): string {
  if (status === 'Running') return 'working';
  if (status === 'Failed') return 'warn';
  if (status === 'Stopped') return 'stopped';
  return 'idle';
}

function workState(agent: AgentStatus): string {
  if (agent.error) return 'Needs attention';
  if (isWorking(agent)) return 'Work in progress';
  if (isIdle(agent)) return 'Ready';
  return 'Unknown';
}

function AgentChip({ agent }: { agent: AgentStatus }) {
  return (
    <div className="project-agent-row">
      <span className="avatar avatar-sm" style={{ background: avatarColor(agent.name) }}>
        {agent.name.charAt(0).toUpperCase()}
      </span>
      <div className="project-agent-info">
        <div className="project-agent-name">{agent.name}</div>
        <div className="card-role">{agent.role}</div>
      </div>
      <StatusPill agent={agent} />
    </div>
  );
}

function AgentMapNode({
  agent,
  latestSession,
}: {
  agent: AgentStatus;
  latestSession: SessionActivity | undefined;
}) {
  const running = latestSession?.status === 'Running';
  const changedLabel = agent.isClean ? 'clean' : `${agent.changedFiles.length} changed`;
  const branch = agent.branch ?? 'No branch';
  const sessionLabel = latestSession
    ? `${latestSession.status} / ${relativeTime(latestSession.endedAtUtc ?? latestSession.startedAtUtc)}`
    : 'No sessions yet';

  return (
    <article className="agent-map-node">
      <div className="agent-map-head">
        <span className="avatar avatar-sm" style={{ background: avatarColor(agent.name) }}>
          {agent.name.charAt(0).toUpperCase()}
        </span>
        <div className="agent-map-title">
          <strong>{agent.name}</strong>
          <span>{agent.role}</span>
        </div>
        <StatusPill agent={agent} running={running} />
      </div>

      <div className="agent-map-repo">
        <span>{agent.repoName ?? 'Unassigned repo'}</span>
        <strong title={agent.repoPath ?? undefined}>{compactPath(agent.repoPath)}</strong>
      </div>

      <div className="agent-map-metrics">
        <div>
          <span>Branch</span>
          <strong>{branch}</strong>
        </div>
        <div>
          <span>Tree</span>
          <strong>{changedLabel}</strong>
        </div>
        <div>
          <span>Base</span>
          <strong>
            {agent.aheadOfBase} ahead / {agent.behindBase} behind
          </strong>
        </div>
      </div>

      <div className="agent-map-footer">
        <span className={`project-session-dot ${sessionStatusClass(latestSession?.status ?? null)}`} />
        <span>{sessionLabel}</span>
      </div>

      <div className={agent.error ? 'agent-map-state warn' : isWorking(agent) ? 'agent-map-state working' : 'agent-map-state'}>
        {agent.error ?? workState(agent)}
      </div>
    </article>
  );
}

export function ProjectShowcase({
  projects,
  agents,
  activity,
}: {
  projects: Project[];
  agents: AgentStatus[];
  activity: SessionActivity[];
}) {
  const unassignedAgents = agents.filter((a) => !a.projectId);
  const latestSessionByAgentId = new Map<string, SessionActivity>();

  for (const entry of activity) {
    if (!latestSessionByAgentId.has(entry.agentId)) {
      latestSessionByAgentId.set(entry.agentId, entry);
    }
  }

  return (
    <div className="project-map-page">
      <div className="project-map-hero">
        <div>
          <p className="section-label">Project Agent Map</p>
          <h2>Parallel work by project</h2>
          <p>See which agents are attached to each project, which repo/worktree they are using, and what state their latest work is in.</p>
        </div>
        <div className="project-map-summary">
          <div>
            <span>Projects</span>
            <strong>{projects.length}</strong>
          </div>
          <div>
            <span>Mapped agents</span>
            <strong>{agents.length - unassignedAgents.length}</strong>
          </div>
          <div>
            <span>Running</span>
            <strong>{activity.filter((entry) => entry.status === 'Running').length}</strong>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="loading">
          No projects yet. Create one in the <strong>Manage</strong> tab and bind agents to it there -
          an agent assigned to a project is always pointed at that project's repo.
        </p>
      ) : (
        <div className="project-map-grid">
          {projects.map((project) => {
            const projectAgents = agents.filter((a) => a.projectId === project.id);
            // The repos actually in use by this project's agents, not the nominal Project.RepoId
            // (which is only ever a default for a new agent with no repo yet, not "the" repo for
            // the whole project - see CLAUDE.md). Showing the real ones avoids implying every
            // agent here runs against the same single repo when that's usually not true.
            const distinctRepoNames = [...new Set(projectAgents.map((a) => a.repoName).filter((n): n is string => !!n))];
            return (
              <section className="project-map-card" key={project.id}>
                <div className="project-map-card-head">
                  <div>
                    <div className="project-card-name">{project.name}</div>
                    <div className="project-map-subtitle">
                      {projectAgents.length} agent{projectAgents.length === 1 ? '' : 's'} mapped
                    </div>
                  </div>
                  <div className="project-card-tags">
                    {project.baseBranch && <span className="repo-tag">base: {project.baseBranch}</span>}
                    {distinctRepoNames.length === 0 ? (
                      <span className="repo-tag">no repos yet</span>
                    ) : (
                      distinctRepoNames.map((name) => (
                        <span className="repo-tag" key={name}>
                          {name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                {projectAgents.length === 0 ? (
                  <p className="loading">No agents assigned yet.</p>
                ) : (
                  <div className="agent-map-grid">
                    {projectAgents.map((agent) => (
                      <AgentMapNode
                        agent={agent}
                        latestSession={latestSessionByAgentId.get(agent.id)}
                        key={agent.id}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {unassignedAgents.length > 0 && (
        <>
          <p className="section-label project-unassigned-label">Unassigned agents</p>
          <div className="project-agent-list project-agent-list-loose">
            {unassignedAgents.map((agent) => (
              <AgentChip agent={agent} key={agent.id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
