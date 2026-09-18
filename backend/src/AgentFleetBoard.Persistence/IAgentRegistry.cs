using AgentFleetBoard.Domain;

namespace AgentFleetBoard.Persistence;

public interface IAgentRegistry
{
    Task<IReadOnlyList<AgentDefinition>> GetAllAsync(CancellationToken cancellationToken);

    Task<AgentDefinition> CreateAsync(string name, string role, CancellationToken cancellationToken);

    /// <summary>Returns null if <paramref name="agentId"/> or <paramref name="repoId"/> isn't a known registry entry.</summary>
    Task<AgentDefinition?> AssignAsync(Guid agentId, Guid repoId, CancellationToken cancellationToken);

    Task<AgentDefinition?> UnassignAsync(Guid agentId, CancellationToken cancellationToken);

    Task<bool> RemoveAsync(Guid agentId, CancellationToken cancellationToken);
}
