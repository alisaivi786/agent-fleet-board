namespace AgentFleetBoard.Domain;

public sealed class AgentDefinition
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    public required string Role { get; set; }

    public Guid? AssignedRepoId { get; set; }

    /// <summary>
    /// When set, this agent is bound to the project's repo - AgentRegistry.AssignProjectAsync keeps
    /// AssignedRepoId in sync with the project's RepoId, so an agent can never end up assigned to a
    /// project but pointed at a different repo.
    /// </summary>
    public Guid? ProjectId { get; set; }

    /// <summary>
    /// Set via POST /api/agents/{id}/acknowledge-divergence: the commit hash the user last
    /// reviewed and accepted as "not actually blocking" while still ahead of base. Only suppresses
    /// the Diverged status while it still matches the agent's *current* LastCommitHash and the
    /// working tree is clean - see the 006 migration for why this can't just be a plain bool.
    /// </summary>
    public string? DivergedAckCommitHash { get; set; }
}
