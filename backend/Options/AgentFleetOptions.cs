namespace AgentFleetBoard.Api.Options;

public sealed class AgentFleetOptions
{
    public const string SectionName = "AgentFleet";

    public IReadOnlyList<AgentDefinition> Agents { get; set; } = [];
}

public sealed class AgentDefinition
{
    public required string Name { get; set; }

    public required string Role { get; set; }

    /// <summary>Absolute path to the git working tree this agent operates in (typically a `git worktree` checkout).</summary>
    public required string RepoPath { get; set; }

    /// <summary>Branch this agent's status is compared against for ahead/behind counts.</summary>
    public string BaseBranch { get; set; } = "develop";
}
