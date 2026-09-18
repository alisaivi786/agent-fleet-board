using AgentFleetBoard.Api.Models;
using AgentFleetBoard.Api.Services;
using AgentFleetBoard.Domain;
using AgentFleetBoard.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Real connection strings are machine-specific and never committed - see appsettings.Local.json.example.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

builder.Services.AddPersistence(builder.Configuration);
builder.Services.AddSingleton<IGitStatusReader, GitStatusReader>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

const string devClientCors = "DevClient";
builder.Services.AddCors(options => options.AddPolicy(devClientCors, policy =>
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
          .AllowAnyHeader()
          .AllowAnyMethod()));

var app = builder.Build();

app.UseCors(devClientCors);

// No authentication yet - every endpoint below is intentionally anonymous. This is a local-only
// tool (see CLAUDE.md); token-based auth and per-endpoint permissions are a later, separate pass.
app.UseSwagger();
app.UseSwaggerUI();

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
    IReadOnlyList<RepoDefinition> repoDefinitions = await repos.GetAllAsync(cancellationToken);
    Dictionary<Guid, RepoDefinition> reposById = repoDefinitions.ToDictionary(r => r.Id);

    // reader.ReadAsync shells out to git and doesn't touch the DbContext, so running these
    // concurrently is safe - unlike the repo lookups above, which must happen on one shared,
    // non-thread-safe DbContext instance before this point, not inside the parallel Select below.
    var statuses = await Task.WhenAll(agentDefinitions.Select(async agent =>
    {
        RepoDefinition? repo = agent.AssignedRepoId is { } repoId && reposById.TryGetValue(repoId, out RepoDefinition? found)
            ? found
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

// Phase 4 (manual-launch bridge): formats a ready-to-run CLI command from the agent's
// registry-resolved repo path - never executes anything itself. The operator copies this into
// their own terminal and runs it. Real dispatch (the backend spawning/supervising the session
// itself) is a separate, later decision - see docs/ROADMAP.md's "open question #1".
app.MapPost("/api/agents/{id:guid}/prepare-prompt", async (
    Guid id, PreparePromptRequest request, IAgentRegistry agents, IRepoRegistry repos, CancellationToken cancellationToken) =>
{
    IReadOnlyList<AgentDefinition> agentDefinitions = await agents.GetAllAsync(cancellationToken);
    AgentDefinition? agent = agentDefinitions.FirstOrDefault(a => a.Id == id);
    if (agent is null)
    {
        return Results.NotFound();
    }

    RepoDefinition? repo = agent.AssignedRepoId is { } repoId ? await repos.GetByIdAsync(repoId, cancellationToken) : null;
    if (repo is null)
    {
        return Results.BadRequest(new { error = "Agent has no repo assigned." });
    }

    string escapedPrompt = request.Prompt.Replace("\"", "\\\"");
    string command = $"cd \"{repo.Path}\" && claude \"{escapedPrompt}\"";
    return Results.Ok(new { command });
});

app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();

internal sealed record CreateRepoRequest(string Name, string Path, string BaseBranch);

internal sealed record CreateAgentRequest(string Name, string Role);

internal sealed record AssignAgentRequest(Guid RepoId);

internal sealed record PreparePromptRequest(string Prompt);
