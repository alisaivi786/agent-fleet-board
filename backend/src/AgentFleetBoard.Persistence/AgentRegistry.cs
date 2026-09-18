using AgentFleetBoard.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgentFleetBoard.Persistence;

/// <summary>
/// Persisted registry of agents, backed by the "agents" table in Postgres. An agent's identity
/// (name/role) is separate from which repo it's currently pointed at - AssignAsync is the only way
/// to change that, and it always validates the repo exists first so an agent can never end up
/// pointed at an unregistered path.
/// </summary>
public sealed class AgentRegistry(AgentFleetBoardDbContext db) : IAgentRegistry
{
    public async Task<IReadOnlyList<AgentDefinition>> GetAllAsync(CancellationToken cancellationToken)
        => await db.Agents.AsNoTracking().OrderBy(a => a.Name).ToListAsync(cancellationToken);

    public async Task<AgentDefinition> CreateAsync(string name, string role, CancellationToken cancellationToken)
    {
        var agent = new AgentDefinition { Id = Guid.NewGuid(), Name = name, Role = role, AssignedRepoId = null };
        db.Agents.Add(agent);
        await db.SaveChangesAsync(cancellationToken);
        return agent;
    }

    public async Task<AgentDefinition?> AssignAsync(Guid agentId, Guid repoId, CancellationToken cancellationToken)
    {
        bool repoExists = await db.Repos.AsNoTracking().AnyAsync(r => r.Id == repoId, cancellationToken);
        if (!repoExists)
        {
            return null;
        }

        AgentDefinition? agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == agentId, cancellationToken);
        if (agent is null)
        {
            return null;
        }

        agent.AssignedRepoId = repoId;
        await db.SaveChangesAsync(cancellationToken);
        return agent;
    }

    public async Task<AgentDefinition?> UnassignAsync(Guid agentId, CancellationToken cancellationToken)
    {
        AgentDefinition? agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == agentId, cancellationToken);
        if (agent is null)
        {
            return null;
        }

        agent.AssignedRepoId = null;
        await db.SaveChangesAsync(cancellationToken);
        return agent;
    }

    public async Task<AgentDefinition?> AssignProjectAsync(Guid agentId, Guid projectId, CancellationToken cancellationToken)
    {
        Project? project = await db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken);
        if (project is null)
        {
            return null;
        }

        AgentDefinition? agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == agentId, cancellationToken);
        if (agent is null)
        {
            return null;
        }

        // Projects are a grouping label, not a hard repo lock: an agent that already tracks a repo
        // (its own worktree, say) keeps it - a project only supplies a default repo for an agent
        // that doesn't have one yet. Never silently repoint an already-assigned agent.
        agent.ProjectId = projectId;
        agent.AssignedRepoId ??= project.RepoId;
        await db.SaveChangesAsync(cancellationToken);
        return agent;
    }

    public async Task<AgentDefinition?> UnassignProjectAsync(Guid agentId, CancellationToken cancellationToken)
    {
        AgentDefinition? agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == agentId, cancellationToken);
        if (agent is null)
        {
            return null;
        }

        agent.ProjectId = null;
        await db.SaveChangesAsync(cancellationToken);
        return agent;
    }

    public async Task<bool> RemoveAsync(Guid agentId, CancellationToken cancellationToken)
    {
        int deleted = await db.Agents.Where(a => a.Id == agentId).ExecuteDeleteAsync(cancellationToken);
        return deleted > 0;
    }
}
