namespace AgentFleetBoard.Domain;

public sealed class RepoDefinition
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    public required string Path { get; set; }

    public required string BaseBranch { get; set; }
}
