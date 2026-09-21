namespace AgentFleetBoard.Api.Models;

public sealed record AgentStatus(
    Guid Id,
    string Name,
    string Role,
    Guid? RepoId,
    string? RepoName,
    string? RepoPath,
    string? Branch,
    bool PathExists,
    bool IsGitRepo,
    bool IsClean,
    IReadOnlyList<string> ChangedFiles,
    string? LastCommitHash,
    string? LastCommitMessage,
    DateTimeOffset? LastCommitDate,
    int AheadOfBase,
    int BehindBase,
    string? Error,
    Guid? ProjectId = null,
    string? ProjectName = null,
    // True only while the agent's *current* LastCommitHash still matches what was acknowledged via
    // POST /api/agents/{id}/acknowledge-divergence AND the working tree is still clean - any new
    // commit or newly-dirty file invalidates it automatically. See AgentDefinition.DivergedAckCommitHash.
    bool DivergenceAcknowledged = false);
