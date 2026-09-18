using AgentFleetBoard.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgentFleetBoard.Persistence;

/// <summary>
/// Persisted registry of repos, backed by the "repos" table in Postgres. This registry is also the
/// allowlist: once an agent is assigned a RepoId here, the resolved Path is the only path
/// GitStatusReader ever sees - never a raw path accepted from a request.
/// </summary>
public sealed class RepoRegistry(AgentFleetBoardDbContext db) : IRepoRegistry
{
    public async Task<IReadOnlyList<RepoDefinition>> GetAllAsync(CancellationToken cancellationToken)
        => await db.Repos.AsNoTracking().OrderBy(r => r.Name).ToListAsync(cancellationToken);

    public async Task<RepoDefinition?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
        => await db.Repos.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public async Task<RepoDefinition?> AddAsync(string name, string path, string baseBranch, CancellationToken cancellationToken)
    {
        if (!Directory.Exists(path))
        {
            return null;
        }

        var repo = new RepoDefinition { Id = Guid.NewGuid(), Name = name, Path = path, BaseBranch = baseBranch };
        db.Repos.Add(repo);
        await db.SaveChangesAsync(cancellationToken);
        return repo;
    }

    public async Task<bool> RemoveAsync(Guid id, CancellationToken cancellationToken)
    {
        int deleted = await db.Repos.Where(r => r.Id == id).ExecuteDeleteAsync(cancellationToken);
        return deleted > 0;
    }
}
