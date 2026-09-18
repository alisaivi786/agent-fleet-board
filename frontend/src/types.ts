export interface AgentStatus {
  name: string;
  role: string;
  repoPath: string;
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
