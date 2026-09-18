using AgentFleetBoard.Api.Models;

namespace AgentFleetBoard.Api.Services;

/// <summary>
/// Persisted registry of agents, backed by backend/data/agents.json (gitignored, same reasoning as
/// repos.json). An agent's identity (name/role) is separate from which repo it's currently pointed
/// at - AssignAsync is the only way to change that, and it always validates the repo against
/// IRepoRegistry so an agent can never end up pointed at an unregistered path.
/// </summary>
public sealed class AgentRegistry : IAgentRegistry
{
    private readonly JsonFileStore<AgentDefinition> _store;
    private readonly IRepoRegistry _repos;

    public AgentRegistry(IWebHostEnvironment environment, IRepoRegistry repos)
    {
        string path = Path.Combine(environment.ContentRootPath, "data", "agents.json");
        _store = new JsonFileStore<AgentDefinition>(path);
        _repos = repos;
    }

    public async Task<IReadOnlyList<AgentDefinition>> GetAllAsync(CancellationToken cancellationToken)
        => await _store.ReadAllAsync(cancellationToken);

    public async Task<AgentDefinition> CreateAsync(string name, string role, CancellationToken cancellationToken)
    {
        var agent = new AgentDefinition(Guid.NewGuid(), name, role, AssignedRepoId: null);
        return await _store.MutateAsync(agents =>
        {
            agents.Add(agent);
            return agent;
        }, cancellationToken);
    }

    public async Task<AgentDefinition?> AssignAsync(Guid agentId, Guid repoId, CancellationToken cancellationToken)
    {
        if (await _repos.GetByIdAsync(repoId, cancellationToken) is null)
        {
            return null;
        }

        return await _store.MutateAsync(agents =>
        {
            int index = agents.FindIndex(agent => agent.Id == agentId);
            if (index < 0)
            {
                return null;
            }

            AgentDefinition updated = agents[index] with { AssignedRepoId = repoId };
            agents[index] = updated;
            return updated;
        }, cancellationToken);
    }

    public async Task<AgentDefinition?> UnassignAsync(Guid agentId, CancellationToken cancellationToken)
        => await _store.MutateAsync(agents =>
        {
            int index = agents.FindIndex(agent => agent.Id == agentId);
            if (index < 0)
            {
                return null;
            }

            AgentDefinition updated = agents[index] with { AssignedRepoId = null };
            agents[index] = updated;
            return updated;
        }, cancellationToken);

    public async Task<bool> RemoveAsync(Guid agentId, CancellationToken cancellationToken)
        => await _store.MutateAsync(agents => agents.RemoveAll(agent => agent.Id == agentId) > 0, cancellationToken);
}
