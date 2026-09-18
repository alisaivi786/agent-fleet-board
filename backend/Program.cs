using AgentFleetBoard.Api.Models;
using AgentFleetBoard.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<IRepoRegistry, RepoRegistry>();
builder.Services.AddSingleton<IAgentRegistry, AgentRegistry>();
builder.Services.AddSingleton<IGitStatusReader, GitStatusReader>();

const string devClientCors = "DevClient";
builder.Services.AddCors(options => options.AddPolicy(devClientCors, policy =>
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
          .AllowAnyHeader()
          .AllowAnyMethod()));

var app = builder.Build();

app.UseCors(devClientCors);

app.MapGet("/api/repos", async (IRepoRegistry repos, CancellationToken cancellationToken) =>
    Results.Ok(await repos.GetAllAsync(cancellationToken)));

app.MapPost("/api/repos", async (CreateRepoRequest request, IRepoRegistry repos, CancellationToken cancellationToken) =>
{
    RepoDefinition? repo = await repos.AddAsync(request.Name, request.Path, request.BaseBranch, cancellationToken);
    return repo is null
        ? Results.BadRequest(new { error = "Path does not exist or is not a directory." })
        : Results.Ok(repo);
});

app.MapDelete("/api/repos/{id:guid}", async (Guid id, IRepoRegistry repos, CancellationToken cancellationToken) =>
    await repos.RemoveAsync(id, cancellationToken) ? Results.NoContent() : Results.NotFound());

app.MapGet("/api/agents", async (
    IAgentRegistry agents, IRepoRegistry repos, IGitStatusReader reader, CancellationToken cancellationToken) =>
{
    IReadOnlyList<AgentDefinition> agentDefinitions = await agents.GetAllAsync(cancellationToken);
    var statuses = await Task.WhenAll(agentDefinitions.Select(async agent =>
    {
        RepoDefinition? repo = agent.AssignedRepoId is { } repoId
            ? await repos.GetByIdAsync(repoId, cancellationToken)
            : null;

        if (repo is null)
        {
            return new AgentStatus(
                agent.Id, agent.Name, agent.Role, null, null, null, null,
                PathExists: false, IsGitRepo: false, IsClean: true, [],
                null, null, null, 0, 0, "No repo assigned.");
        }

        return await reader.ReadAsync(
            agent.Id, agent.Name, agent.Role, repo.Id, repo.Name, repo.Path, repo.BaseBranch, cancellationToken);
    }));
    return Results.Ok(statuses);
});

app.MapPost("/api/agents", async (CreateAgentRequest request, IAgentRegistry agents, CancellationToken cancellationToken) =>
    Results.Ok(await agents.CreateAsync(request.Name, request.Role, cancellationToken)));

app.MapPost("/api/agents/{id:guid}/assign", async (
    Guid id, AssignAgentRequest request, IAgentRegistry agents, CancellationToken cancellationToken) =>
{
    AgentDefinition? updated = await agents.AssignAsync(id, request.RepoId, cancellationToken);
    return updated is null ? Results.BadRequest(new { error = "Unknown agent or repo id." }) : Results.Ok(updated);
});

app.MapPost("/api/agents/{id:guid}/unassign", async (Guid id, IAgentRegistry agents, CancellationToken cancellationToken) =>
{
    AgentDefinition? updated = await agents.UnassignAsync(id, cancellationToken);
    return updated is null ? Results.NotFound() : Results.Ok(updated);
});

app.MapDelete("/api/agents/{id:guid}", async (Guid id, IAgentRegistry agents, CancellationToken cancellationToken) =>
    await agents.RemoveAsync(id, cancellationToken) ? Results.NoContent() : Results.NotFound());

app.MapGet("/", () => Results.Redirect("/api/agents"));

app.Run();

internal sealed record CreateRepoRequest(string Name, string Path, string BaseBranch);

internal sealed record CreateAgentRequest(string Name, string Role);

internal sealed record AssignAgentRequest(Guid RepoId);
