namespace AgentFleetBoard.Domain;

/// <summary>A named grouping bound to exactly one repo - agents assigned to it always run against that repo.</summary>
public sealed class Project
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    public Guid RepoId { get; set; }
}
