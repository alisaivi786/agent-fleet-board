using AgentFleetBoard.Domain;

namespace AgentFleetBoard.Api.Models;

/// <summary>An AgentSession joined with the agent's name for display - backs the Activity Log.</summary>
public sealed record SessionActivity(
    Guid Id,
    Guid AgentId,
    string AgentName,
    Guid RepoId,
    string RepoPath,
    string Prompt,
    SessionStatus Status,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset? EndedAtUtc,
    int? ExitCode);
