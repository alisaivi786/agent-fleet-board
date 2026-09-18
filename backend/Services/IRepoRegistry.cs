using AgentFleetBoard.Api.Models;

namespace AgentFleetBoard.Api.Services;

public interface IRepoRegistry
{
    Task<IReadOnlyList<RepoDefinition>> GetAllAsync(CancellationToken cancellationToken);

    Task<RepoDefinition?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Validates that <paramref name="path"/> exists and is a directory before persisting. Returns null if it doesn't.</summary>
    Task<RepoDefinition?> AddAsync(string name, string path, string baseBranch, CancellationToken cancellationToken);

    Task<bool> RemoveAsync(Guid id, CancellationToken cancellationToken);
}
