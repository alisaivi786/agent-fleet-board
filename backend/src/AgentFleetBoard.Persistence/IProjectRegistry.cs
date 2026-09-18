using AgentFleetBoard.Domain;

namespace AgentFleetBoard.Persistence;

public interface IProjectRegistry
{
    Task<IReadOnlyList<Project>> GetAllAsync(CancellationToken cancellationToken);

    Task<Project?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Returns null if <paramref name="repoId"/> isn't a known registry entry.</summary>
    Task<Project?> CreateAsync(string name, Guid repoId, CancellationToken cancellationToken);

    Task<bool> RemoveAsync(Guid id, CancellationToken cancellationToken);
}
