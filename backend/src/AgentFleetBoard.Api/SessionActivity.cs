using AgentFleetBoard.Domain;

namespace AgentFleetBoard.Api.Models;

/// <summary>An AgentSession joined with the agent's name for display - backs the Activity Log.</summary>
public sealed record SessionActivity(
    Guid Id,
    Guid AgentId,
    string AgentName,
    string AgentRole,
    string? ProjectName,
    Guid RepoId,
    string RepoName,
    string RepoPath,
    string Prompt,
    SessionStatus Status,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset? EndedAtUtc,
    long? DurationMs,
    int? ExitCode,
    string? FailureSummary);
