import type { AgentStatus, Project, RepoDefinition } from '../types';
import { RepoManager } from '../components/RepoManager';
import { ProjectManager } from '../components/ProjectManager';
import { AgentManager } from '../components/AgentManager';

export function ManagePage({
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
  return (
    <>
      <RepoManager repos={repos} onChange={onChange} />
      <ProjectManager projects={projects} repos={repos} onChange={onChange} />
      <AgentManager agents={agents} repos={repos} projects={projects} onChange={onChange} />
    </>
  );
}
