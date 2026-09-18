using AgentFleetBoard.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgentFleetBoard.Persistence;

/// <summary>
/// Persisted registry of projects, backed by the "projects" table. Like AgentRegistry.AssignAsync,
/// CreateAsync validates the repo exists first - a project can never end up bound to an
/// unregistered path.
/// </summary>
public sealed class ProjectRegistry(AgentFleetBoardDbContext db) : IProjectRegistry
{
    public async Task<IReadOnlyList<Project>> GetAllAsync(CancellationToken cancellationToken)
        => await db.Projects.AsNoTracking().OrderBy(p => p.Name).ToListAsync(cancellationToken);

    public async Task<Project?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
        => await db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    public async Task<Project?> CreateAsync(string name, Guid repoId, CancellationToken cancellationToken)
    {
        bool repoExists = await db.Repos.AsNoTracking().AnyAsync(r => r.Id == repoId, cancellationToken);
        if (!repoExists)
        {
            return null;
        }

        var project = new Project { Id = Guid.NewGuid(), Name = name, RepoId = repoId };
        db.Projects.Add(project);
        await db.SaveChangesAsync(cancellationToken);
        return project;
    }

    public async Task<bool> RemoveAsync(Guid id, CancellationToken cancellationToken)
    {
        int deleted = await db.Projects.Where(p => p.Id == id).ExecuteDeleteAsync(cancellationToken);
        return deleted > 0;
    }
}
