using AgentFleetBoard.Domain;

namespace AgentFleetBoard.Persistence;

public interface IAgentRegistry
{
    Task<IReadOnlyList<AgentDefinition>> GetAllAsync(CancellationToken cancellationToken);

    Task<AgentDefinition?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<AgentDefinition> CreateAsync(string name, string role, CancellationToken cancellationToken);

    /// <summary>Returns null if <paramref name="agentId"/> or <paramref name="repoId"/> isn't a known registry entry.</summary>
    Task<AgentDefinition?> AssignAsync(Guid agentId, Guid repoId, CancellationToken cancellationToken);

    Task<AgentDefinition?> UnassignAsync(Guid agentId, CancellationToken cancellationToken);

    /// <summary>
    /// Assigns the agent to a project - a grouping label, not a hard repo lock. If the agent has no
    /// repo yet, it defaults to the project's RepoId; an agent that already tracks a repo (e.g. its
    /// own worktree) keeps it untouched. Returns null if <paramref name="agentId"/> or
    /// <paramref name="projectId"/> isn't a known registry entry.
    /// </summary>
    Task<AgentDefinition?> AssignProjectAsync(Guid agentId, Guid projectId, CancellationToken cancellationToken);

    Task<AgentDefinition?> UnassignProjectAsync(Guid agentId, CancellationToken cancellationToken);

    /// <summary>
    /// Records that the user has reviewed and accepted the agent's current Diverged state at
    /// <paramref name="commitHash"/>, without touching its repo assignment. Returns null if
    /// <paramref name="agentId"/> isn't a known registry entry.
    /// </summary>
    Task<AgentDefinition?> AcknowledgeDivergenceAsync(Guid agentId, string commitHash, CancellationToken cancellationToken);

    Task<bool> RemoveAsync(Guid agentId, CancellationToken cancellationToken);
}
