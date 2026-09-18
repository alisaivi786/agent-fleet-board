namespace AgentFleetBoard.Api.Models;

public sealed record AgentDefinition(Guid Id, string Name, string Role, Guid? AssignedRepoId);
