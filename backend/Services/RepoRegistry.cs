using AgentFleetBoard.Api.Models;

namespace AgentFleetBoard.Api.Services;

/// <summary>
/// Persisted registry of repos, backed by backend/data/repos.json (gitignored - same reasoning as
/// appsettings.Local.json, never commit real local paths). This registry is also the allowlist:
/// once an agent is assigned a RepoId here, the resolved Path is the only path GitStatusReader ever
/// sees - never a raw path accepted from a request.
/// </summary>
public sealed class RepoRegistry : IRepoRegistry
{
    private readonly JsonFileStore<RepoDefinition> _store;

    public RepoRegistry(IWebHostEnvironment environment)
    {
        string path = Path.Combine(environment.ContentRootPath, "data", "repos.json");
        _store = new JsonFileStore<RepoDefinition>(path);
    }

    public async Task<IReadOnlyList<RepoDefinition>> GetAllAsync(CancellationToken cancellationToken)
        => await _store.ReadAllAsync(cancellationToken);

    public async Task<RepoDefinition?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
        => (await _store.ReadAllAsync(cancellationToken)).FirstOrDefault(repo => repo.Id == id);

    public async Task<RepoDefinition?> AddAsync(string name, string path, string baseBranch, CancellationToken cancellationToken)
    {
        if (!Directory.Exists(path))
        {
            return null;
        }

        var repo = new RepoDefinition(Guid.NewGuid(), name, path, baseBranch);
        return await _store.MutateAsync(repos =>
        {
            repos.Add(repo);
            return repo;
        }, cancellationToken);
    }

    public async Task<bool> RemoveAsync(Guid id, CancellationToken cancellationToken)
        => await _store.MutateAsync(repos => repos.RemoveAll(repo => repo.Id == id) > 0, cancellationToken);
}
