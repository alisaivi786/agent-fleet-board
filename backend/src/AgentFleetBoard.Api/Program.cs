using System.Text.Json.Serialization;
using AgentFleetBoard.Api.Models;
using AgentFleetBoard.Api.Services;
using AgentFleetBoard.Domain;
using AgentFleetBoard.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Real connection strings are machine-specific and never committed - see appsettings.Local.json.example.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

builder.Services.AddPersistence(builder.Configuration);
builder.Services.AddSingleton<IGitStatusReader, GitStatusReader>();
builder.Services.AddSingleton<ISessionRunner, SessionRunner>();
builder.Services.AddSingleton<IWorktreeScanner, WorktreeScanner>();
builder.Services.AddSingleton<SystemMetricsSampler>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<SystemMetricsSampler>());

// Without this, AgentSession.Status (a C# enum) serializes as a raw int - the frontend needs the
// name ("Running"/"Succeeded"/...), not the ordinal.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

string sessionLogDirectory = Path.Combine(builder.Environment.ContentRootPath, "logs");

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

// "Connect a repo, get its agents for free": most real usage is one agent per git worktree under
// a shared repo (e.g. Claude Code's own .claude/worktrees/<name> convention), not one hand-typed
// repo entry per agent. For each *linked* worktree (the main worktree at repo.Path is skipped -
// that's already this repo), registers a repo entry for its path if one doesn't already exist, and
// creates+assigns a new agent if no existing agent already points at that repo - idempotent, so
// running this again after manually tweaking names/roles won't create duplicates.
app.MapPost("/api/repos/{id:guid}/discover-worktrees", async (
    Guid id, IRepoRegistry repos, IAgentRegistry agents, IWorktreeScanner scanner, CancellationToken cancellationToken) =>
{
    RepoDefinition? repo = await repos.GetByIdAsync(id, cancellationToken);
    if (repo is null)
    {
        return Results.NotFound();
    }

    IReadOnlyList<WorktreeInfo> worktrees = await scanner.ListLinkedWorktreesAsync(repo.Path, cancellationToken);
    IReadOnlyList<RepoDefinition> existingRepos = await repos.GetAllAsync(cancellationToken);
    IReadOnlyList<AgentDefinition> existingAgents = await agents.GetAllAsync(cancellationToken);

    var createdRepos = new List<RepoDefinition>();
    var createdAgents = new List<AgentDefinition>();

    foreach (WorktreeInfo worktree in worktrees)
    {
        RepoDefinition? matchedRepo = existingRepos.Concat(createdRepos).FirstOrDefault(r => SamePath(r.Path, worktree.Path));

        if (matchedRepo is null)
        {
            string repoName = Path.GetFileName(worktree.Path.TrimEnd('\\', '/'));
            RepoDefinition? added = await repos.AddAsync(repoName, worktree.Path, repo.BaseBranch, cancellationToken);
            if (added is null)
            {
                continue; // Path vanished between the scan above and this add - skip it.
            }

            matchedRepo = added;
            createdRepos.Add(added);
        }

        bool agentAlreadyExists = existingAgents.Concat(createdAgents).Any(a => a.AssignedRepoId == matchedRepo.Id);
        if (agentAlreadyExists)
        {
            continue;
        }

        string folderName = Path.GetFileName(worktree.Path.TrimEnd('\\', '/'));
        string agentName = folderName.Length == 0 ? folderName : char.ToUpperInvariant(folderName[0]) + folderName[1..];
        AgentDefinition created = await agents.CreateAsync(agentName, "Agent", cancellationToken);
        AgentDefinition? assigned = await agents.AssignAsync(created.Id, matchedRepo.Id, cancellationToken);
        createdAgents.Add(assigned ?? created);
    }

    return Results.Ok(new { createdRepos, createdAgents });

    static bool SamePath(string a, string b) =>
        string.Equals(Path.GetFullPath(a).TrimEnd('\\', '/'), Path.GetFullPath(b).TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase);
});

app.MapGet("/api/agents", async (
    IAgentRegistry agents, IRepoRegistry repos, IProjectRegistry projects, IGitStatusReader reader,
    CancellationToken cancellationToken) =>
{
    IReadOnlyList<AgentDefinition> agentDefinitions = await agents.GetAllAsync(cancellationToken);
    IReadOnlyList<RepoDefinition> repoDefinitions = await repos.GetAllAsync(cancellationToken);
    IReadOnlyList<Project> projectDefinitions = await projects.GetAllAsync(cancellationToken);
    Dictionary<Guid, RepoDefinition> reposById = repoDefinitions.ToDictionary(r => r.Id);
    Dictionary<Guid, Project> projectsById = projectDefinitions.ToDictionary(p => p.Id);

    // reader.ReadAsync shells out to git and doesn't touch the DbContext, so running these
    // concurrently is safe - unlike the repo/project lookups above, which must happen on one
    // shared, non-thread-safe DbContext instance before this point, not inside the parallel
    // Select below.
    var statuses = await Task.WhenAll(agentDefinitions.Select(async agent =>
    {
        RepoDefinition? repo = agent.AssignedRepoId is { } repoId && reposById.TryGetValue(repoId, out RepoDefinition? found)
            ? found
            : null;
        string? projectName = agent.ProjectId is { } projectId && projectsById.TryGetValue(projectId, out Project? project)
            ? project.Name
            : null;

        if (repo is null)
        {
            return new AgentStatus(
                agent.Id, agent.Name, agent.Role, null, null, null, null,
                PathExists: false, IsGitRepo: false, IsClean: true, [],
                null, null, null, 0, 0, "No repo assigned.", agent.ProjectId, projectName);
        }

        AgentStatus status = await reader.ReadAsync(
            agent.Id, agent.Name, agent.Role, repo.Id, repo.Name, repo.Path, repo.BaseBranch, cancellationToken);
        bool divergenceAcknowledged = agent.DivergedAckCommitHash is not null
            && status.IsClean
            && agent.DivergedAckCommitHash == status.LastCommitHash;
        return status with { ProjectId = agent.ProjectId, ProjectName = projectName, DivergenceAcknowledged = divergenceAcknowledged };
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

app.MapPost("/api/agents/{id:guid}/acknowledge-divergence", async (
    Guid id, IAgentRegistry agents, IRepoRegistry repos, IGitStatusReader reader, CancellationToken cancellationToken) =>
{
    AgentDefinition? agent = await agents.GetByIdAsync(id, cancellationToken);
    if (agent is null)
    {
        return Results.NotFound();
    }

    if (agent.AssignedRepoId is not { } repoId)
    {
        return Results.BadRequest(new { error = "Agent has no assigned repo to acknowledge." });
    }

    RepoDefinition? repo = await repos.GetByIdAsync(repoId, cancellationToken);
    if (repo is null)
    {
        return Results.BadRequest(new { error = "Assigned repo no longer exists." });
    }

    // Re-reads git state itself rather than trusting whatever the client last polled, so the
    // acknowledged commit hash always reflects what's actually on disk right now.
    AgentStatus current = await reader.ReadAsync(
        agent.Id, agent.Name, agent.Role, repo.Id, repo.Name, repo.Path, repo.BaseBranch, cancellationToken);
    if (!current.IsClean)
    {
        return Results.BadRequest(new { error = "Working tree still has uncommitted changes - commit or discard them first." });
    }

    AgentDefinition? updated = await agents.AcknowledgeDivergenceAsync(id, current.LastCommitHash ?? "", cancellationToken);
    return updated is null ? Results.NotFound() : Results.Ok(updated);
});

app.MapPost("/api/agents/{id:guid}/assign-project", async (
    Guid id, AssignAgentProjectRequest request, IAgentRegistry agents, CancellationToken cancellationToken) =>
{
    AgentDefinition? updated = await agents.AssignProjectAsync(id, request.ProjectId, cancellationToken);
    return updated is null ? Results.BadRequest(new { error = "Unknown agent or project id." }) : Results.Ok(updated);
});

app.MapPost("/api/agents/{id:guid}/unassign-project", async (Guid id, IAgentRegistry agents, CancellationToken cancellationToken) =>
{
    AgentDefinition? updated = await agents.UnassignProjectAsync(id, cancellationToken);
    return updated is null ? Results.NotFound() : Results.Ok(updated);
});

app.MapGet("/api/projects", async (IProjectRegistry projects, CancellationToken cancellationToken) =>
    Results.Ok(await projects.GetAllAsync(cancellationToken)));

app.MapPost("/api/projects", async (CreateProjectRequest request, IProjectRegistry projects, CancellationToken cancellationToken) =>
{
    Project? project = await projects.CreateAsync(request.Name, request.RepoId, request.BaseBranch, cancellationToken);
    return project is null ? Results.BadRequest(new { error = "Unknown repo id." }) : Results.Ok(project);
});

app.MapDelete("/api/projects/{id:guid}", async (Guid id, IProjectRegistry projects, CancellationToken cancellationToken) =>
    await projects.RemoveAsync(id, cancellationToken) ? Results.NoContent() : Results.NotFound());

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

// Real dispatch: spawns a real `claude` subprocess against the agent's registry-resolved repo
// path. This is the point where the tool's security model changes shape - see the security note
// in CLAUDE.md and SessionRunner's doc comment. Still no auth: anyone who can reach this API can
// trigger a real coding session against any registered repo.
app.MapPost("/api/agents/{id:guid}/sessions", async (
    Guid id, StartSessionRequest request,
    IAgentRegistry agents, IRepoRegistry repos, ISessionRegistry sessions, ISessionRunner runner,
    CancellationToken cancellationToken) =>
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

    string logPath = Path.Combine(sessionLogDirectory, $"{Guid.NewGuid()}.log");
    AgentSession session = await sessions.CreateAsync(agent.Id, repo.Id, repo.Path, request.Prompt, logPath, cancellationToken);

    int processId = runner.Start(session.Id, repo.Path, request.Prompt, session.LogPath);
    await sessions.SetRunningAsync(session.Id, processId, cancellationToken);
    session.ProcessId = processId;

    return Results.Ok(session);
});

app.MapGet("/api/agents/{id:guid}/sessions", async (Guid id, ISessionRegistry sessions, CancellationToken cancellationToken) =>
    Results.Ok(await sessions.GetForAgentAsync(id, cancellationToken)));

// Backs the Activity Log - recent sessions across every agent, newest first, joined with agent
// name for display. Capped at 100; this is a local dev tool with modest session volume, not a
// paginated audit log.
app.MapGet("/api/sessions", async (
    IAgentRegistry agents, IRepoRegistry repos, IProjectRegistry projects, ISessionRegistry sessions,
    CancellationToken cancellationToken) =>
{
    IReadOnlyList<AgentSession> recent = await sessions.GetRecentAsync(100, cancellationToken);
    IReadOnlyList<AgentDefinition> agentDefinitions = await agents.GetAllAsync(cancellationToken);
    IReadOnlyList<RepoDefinition> repoDefinitions = await repos.GetAllAsync(cancellationToken);
    IReadOnlyList<Project> projectDefinitions = await projects.GetAllAsync(cancellationToken);

    Dictionary<Guid, AgentDefinition> agentsById = agentDefinitions.ToDictionary(a => a.Id);
    Dictionary<Guid, RepoDefinition> reposById = repoDefinitions.ToDictionary(r => r.Id);
    Dictionary<Guid, Project> projectsById = projectDefinitions.ToDictionary(p => p.Id);

    var activity = await Task.WhenAll(recent.Select(async s =>
    {
        agentsById.TryGetValue(s.AgentId, out AgentDefinition? agent);
        reposById.TryGetValue(s.RepoId, out RepoDefinition? repo);
        Project? project = agent?.ProjectId is { } projectId && projectsById.TryGetValue(projectId, out Project? foundProject)
            ? foundProject
            : null;
        long? durationMs = s.EndedAtUtc is { } endedAt
            ? Math.Max(0, (long)(endedAt - s.StartedAtUtc).TotalMilliseconds)
            : null;
        string? failureSummary = s.Status == SessionStatus.Failed
            ? await FailureSummaryReader.ReadAsync(s.LogPath, cancellationToken)
            : null;

        return new SessionActivity(
            s.Id,
            s.AgentId,
            agent?.Name ?? "Unknown agent",
            agent?.Role ?? "Unknown role",
            project?.Name,
            s.RepoId,
            repo?.Name ?? Path.GetFileName(s.RepoPath.TrimEnd('\\', '/')),
            s.RepoPath,
            s.Prompt,
            s.Status,
            s.StartedAtUtc,
            s.EndedAtUtc,
            durationMs,
            s.ExitCode,
            failureSummary);
    }));
    return Results.Ok(activity);
});

app.MapGet("/api/system/metrics", (SystemMetricsSampler sampler) => Results.Ok(sampler.GetLatest()));

app.MapGet("/api/sessions/{id:guid}", async (Guid id, ISessionRegistry sessions, CancellationToken cancellationToken) =>
{
    AgentSession? session = await sessions.GetByIdAsync(id, cancellationToken);
    return session is null ? Results.NotFound() : Results.Ok(session);
});

app.MapGet("/api/sessions/{id:guid}/log", async (Guid id, ISessionRegistry sessions, CancellationToken cancellationToken) =>
{
    AgentSession? session = await sessions.GetByIdAsync(id, cancellationToken);
    if (session is null)
    {
        return Results.NotFound();
    }

    if (!File.Exists(session.LogPath))
    {
        return Results.Ok(new { log = "" });
    }

    // Small local tool, modest log sizes expected - read the whole file rather than tailing it.
    // Explicit FileShare.ReadWrite to match SessionRunner's writer, which is still open while the
    // session is Running - File.ReadAllTextAsync's default share mode isn't broad enough for that.
    string log;
    using (var stream = new FileStream(session.LogPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
    using (var reader = new StreamReader(stream))
    {
        log = await reader.ReadToEndAsync(cancellationToken);
    }
    return Results.Ok(new { log });
});

app.MapPost("/api/sessions/{id:guid}/stop", (Guid id, ISessionRunner runner) =>
    runner.Stop(id) ? Results.NoContent() : Results.NotFound());

// "Free" a session stuck as Running - covers the known limitation where an API restart loses
// SessionRunner's in-memory tracking (see CLAUDE.md), so runner.Stop(id) alone can no longer find
// the process. Tries to kill the OS process by its last-known id too (best-effort - it may already
// be gone, or may have been recycled by the OS into an unrelated process, hence the narrow catch),
// then always forces the DB row out of Running so the agent shows as free again either way.
app.MapPost("/api/sessions/{id:guid}/force-stop", async (
    Guid id, ISessionRunner runner, ISessionRegistry sessions, CancellationToken cancellationToken) =>
{
    AgentSession? session = await sessions.GetByIdAsync(id, cancellationToken);
    if (session is null)
    {
        return Results.NotFound();
    }

    if (session.Status != SessionStatus.Running)
    {
        return Results.Ok(session);
    }

    if (!runner.Stop(id) && session.ProcessId is { } processId)
    {
        try
        {
            System.Diagnostics.Process.GetProcessById(processId).Kill(entireProcessTree: true);
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            // Already exited, or the pid was recycled into an unrelated process by the OS - either
            // way there's nothing left to kill, so just fall through to freeing the DB row below.
        }
    }

    await sessions.CompleteAsync(id, SessionStatus.Stopped, null, cancellationToken);
    return Results.Ok(await sessions.GetByIdAsync(id, cancellationToken));
});

app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();

internal sealed record CreateRepoRequest(string Name, string Path, string BaseBranch);

internal sealed record CreateAgentRequest(string Name, string Role);

internal sealed record AssignAgentRequest(Guid RepoId);

internal sealed record PreparePromptRequest(string Prompt);

internal sealed record CreateProjectRequest(string Name, Guid? RepoId, string? BaseBranch);

internal sealed record AssignAgentProjectRequest(Guid ProjectId);

internal sealed record StartSessionRequest(string Prompt);

internal static class FailureSummaryReader
{
    public static async Task<string?> ReadAsync(string logPath, CancellationToken cancellationToken)
    {
        if (!File.Exists(logPath))
        {
            return null;
        }

        string log;
        using (var stream = new FileStream(logPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
        using (var reader = new StreamReader(stream))
        {
            log = await reader.ReadToEndAsync(cancellationToken);
        }

        string[] lines = log
            .Split('\n')
            .Select(line => line.Trim())
            .Where(line => line.Length > 0)
            .TakeLast(8)
            .ToArray();

        if (lines.Length == 0)
        {
            return null;
        }

        string summary = string.Join(Environment.NewLine, lines);
        return summary.Length <= 900 ? summary : summary[^900..];
    }
}
