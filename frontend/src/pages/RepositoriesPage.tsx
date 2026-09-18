import type { AgentStatus, Project, RepoDefinition } from '../types';

export function RepositoriesPage({
  repos,
  agents,
  projects,
}: {
  repos: RepoDefinition[];
  agents: AgentStatus[];
  projects: Project[];
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Repositories</span>
      </div>
      {repos.length === 0 ? (
        <p className="loading">
          No repos registered yet. Add one in the <strong>Manage</strong> tab.
        </p>
      ) : (
        <table className="manage-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Path</th>
              <th>Base branch</th>
              <th>Agents</th>
              <th>Projects</th>
            </tr>
          </thead>
          <tbody>
            {repos.map((repo) => {
              const repoAgents = agents.filter((a) => a.repoId === repo.id);
              const repoProjects = projects.filter((p) => p.repoId === repo.id);
              return (
                <tr key={repo.id}>
                  <td>{repo.name}</td>
                  <td className="mono-cell">{repo.path}</td>
                  <td>{repo.baseBranch}</td>
                  <td>{repoAgents.length === 0 ? '—' : repoAgents.map((a) => a.name).join(', ')}</td>
                  <td>{repoProjects.length === 0 ? '—' : repoProjects.map((p) => p.name).join(', ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
