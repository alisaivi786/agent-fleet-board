import type { AgentStatus, Project } from '../types';
import { avatarColor } from '../colors';
import { StatusPill } from './StatusPill';

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

export function ProjectShowcase({
  projects,
  agents,
}: {
  projects: Project[];
  agents: AgentStatus[];
}) {
  const unassignedAgents = agents.filter((a) => !a.projectId);

  return (
    <div>
      <p className="section-label">Projects</p>

      {projects.length === 0 ? (
        <p className="loading">
          No projects yet. Create one in the <strong>Manage</strong> tab and bind agents to it there -
          an agent assigned to a project is always pointed at that project's repo.
        </p>
      ) : (
        <div className="project-grid">
          {projects.map((project) => {
            const projectAgents = agents.filter((a) => a.projectId === project.id);
            // The repos actually in use by this project's agents, not the nominal Project.RepoId
            // (which is only ever a default for a new agent with no repo yet, not "the" repo for
            // the whole project - see CLAUDE.md). Showing the real ones avoids implying every
            // agent here runs against the same single repo when that's usually not true.
            const distinctRepoNames = [...new Set(projectAgents.map((a) => a.repoName).filter((n): n is string => !!n))];
            return (
              <div className="project-card" key={project.id}>
                <div className="project-card-head">
                  <div className="project-card-name">{project.name}</div>
                  <div className="project-card-tags">
                    {project.baseBranch && <span className="repo-tag">base: {project.baseBranch}</span>}
                    {distinctRepoNames.length === 0 ? (
                      <span className="repo-tag">no repos yet</span>
                    ) : (
                      distinctRepoNames.map((name) => <span className="repo-tag" key={name}>{name}</span>)
                    )}
                  </div>
                </div>
                {projectAgents.length === 0 ? (
                  <p className="loading">No agents assigned yet.</p>
                ) : (
                  <div className="project-agent-list">
                    {projectAgents.map((agent) => (
                      <AgentChip agent={agent} key={agent.id} />
                    ))}
                  </div>
                )}
              </div>
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
