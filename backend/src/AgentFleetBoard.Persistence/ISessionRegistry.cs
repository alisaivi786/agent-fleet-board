using AgentFleetBoard.Domain;

namespace AgentFleetBoard.Persistence;

public interface ISessionRegistry
{
    Task<AgentSession> CreateAsync(Guid agentId, Guid repoId, string repoPath, string prompt, string logPath, CancellationToken cancellationToken);

    Task<AgentSession?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<AgentSession>> GetForAgentAsync(Guid agentId, CancellationToken cancellationToken);

    /// <summary>Most recent sessions across every agent, newest first, capped at <paramref name="limit"/> - backs the Activity Log.</summary>
    Task<IReadOnlyList<AgentSession>> GetRecentAsync(int limit, CancellationToken cancellationToken);

    Task SetRunningAsync(Guid id, int processId, CancellationToken cancellationToken);

    Task CompleteAsync(Guid id, SessionStatus status, int? exitCode, CancellationToken cancellationToken);
}
