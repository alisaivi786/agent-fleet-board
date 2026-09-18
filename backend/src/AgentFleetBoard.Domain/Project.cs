namespace AgentFleetBoard.Domain;

/// <summary>
/// A named grouping of agents. RepoId is optional - it's only ever used as a default repo for a
/// brand new agent assigned to this project with no repo yet (see AgentRegistry.AssignProjectAsync);
/// it is NOT "the project's repo" - agents in the same project commonly run against different
/// repos (e.g. one worktree each of the same underlying codebase), so nothing here should treat
/// RepoId as authoritative for the whole project.
/// </summary>
public sealed class Project
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    public Guid? RepoId { get; set; }

    /// <summary>
    /// Descriptive only (e.g. "develop") - never read by GitStatusReader. Ahead/behind for every
    /// agent always comes from its own repo's RepoDefinition.BaseBranch, not this field.
    /// </summary>
    public string? BaseBranch { get; set; }
}
