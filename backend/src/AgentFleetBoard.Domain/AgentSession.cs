namespace AgentFleetBoard.Domain;

public enum SessionStatus
{
    Running,
    Succeeded,
    Failed,
    Stopped,
}

/// <summary>
/// One real-dispatch run of an agent: a `claude` subprocess launched against its assigned repo
/// with a given prompt. Session rows are history/audit - deleting the repo or unassigning the
/// agent afterward doesn't retroactively invalidate them, so RepoId/RepoPath are a point-in-time
/// snapshot, not a live foreign key into the current registry.
/// </summary>
public sealed class AgentSession
{
    public Guid Id { get; set; }

    public Guid AgentId { get; set; }

    public Guid RepoId { get; set; }

    public required string RepoPath { get; set; }

    public required string Prompt { get; set; }

    public SessionStatus Status { get; set; }

    public int? ProcessId { get; set; }

    public required string LogPath { get; set; }

    public DateTimeOffset StartedAtUtc { get; set; }

    public DateTimeOffset? EndedAtUtc { get; set; }

    public int? ExitCode { get; set; }
}
