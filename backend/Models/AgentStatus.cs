namespace AgentFleetBoard.Api.Models;

public sealed record AgentStatus(
    string Name,
    string Role,
    string RepoPath,
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
    string? Error);
