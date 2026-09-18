import type { AgentStatus, RepoDefinition } from '../types';

export function RepositoriesPage({
  repos,
  agents,
}: {
  repos: RepoDefinition[];
  agents: AgentStatus[];
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
              // Derived from the agents actually on this repo, not Project.RepoId - that field is
              // only ever a default for a brand new agent, not "the" repo for a project (a project
              // commonly has agents spread across several repos). See CLAUDE.md.
              const repoProjectNames = [...new Set(repoAgents.map((a) => a.projectName).filter((n): n is string => !!n))];
              return (
                <tr key={repo.id}>
                  <td>{repo.name}</td>
                  <td className="mono-cell">{repo.path}</td>
                  <td>{repo.baseBranch}</td>
                  <td>{repoAgents.length === 0 ? '—' : repoAgents.map((a) => a.name).join(', ')}</td>
                  <td>{repoProjectNames.length === 0 ? '—' : repoProjectNames.join(', ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
