namespace AgentFleetBoard.Domain;

public sealed class AgentDefinition
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    public required string Role { get; set; }

    public Guid? AssignedRepoId { get; set; }
}
