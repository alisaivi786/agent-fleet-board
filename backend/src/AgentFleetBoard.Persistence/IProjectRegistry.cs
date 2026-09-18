using AgentFleetBoard.Domain;

namespace AgentFleetBoard.Persistence;

public interface IProjectRegistry
{
    Task<IReadOnlyList<Project>> GetAllAsync(CancellationToken cancellationToken);

    Task<Project?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// <paramref name="repoId"/> is optional - only ever used as a default repo for a new agent
    /// assigned to this project with no repo yet. <paramref name="baseBranch"/> is descriptive
    /// metadata only (see Project.BaseBranch). Returns null if a non-null repoId isn't a known
    /// registry entry.
    /// </summary>
    Task<Project?> CreateAsync(string name, Guid? repoId, string? baseBranch, CancellationToken cancellationToken);

    Task<bool> RemoveAsync(Guid id, CancellationToken cancellationToken);
}
