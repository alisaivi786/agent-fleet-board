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
}
