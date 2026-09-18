export interface AgentStatus {
  id: string;
  name: string;
  role: string;
  repoId: string | null;
  repoName: string | null;
  repoPath: string | null;
  branch: string | null;
  pathExists: boolean;
  isGitRepo: boolean;
  isClean: boolean;
  changedFiles: string[];
  lastCommitHash: string | null;
  lastCommitMessage: string | null;
  lastCommitDate: string | null;
  aheadOfBase: number;
  behindBase: number;
  error: string | null;
  projectId: string | null;
  projectName: string | null;
}

export interface Project {
  id: string;
  name: string;
  repoId: string;
}

export interface RepoDefinition {
  id: string;
  name: string;
  path: string;
  baseBranch: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  assignedRepoId: string | null;
  projectId: string | null;
}

export type SessionStatus = 'Running' | 'Succeeded' | 'Failed' | 'Stopped';

export interface AgentSession {
  id: string;
  agentId: string;
  repoId: string;
  repoPath: string;
  prompt: string;
  status: SessionStatus;
  processId: number | null;
  logPath: string;
  startedAtUtc: string;
  endedAtUtc: string | null;
  exitCode: number | null;
}
