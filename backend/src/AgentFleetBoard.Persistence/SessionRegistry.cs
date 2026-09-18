using AgentFleetBoard.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgentFleetBoard.Persistence;

public sealed class SessionRegistry(AgentFleetBoardDbContext db) : ISessionRegistry
{
    public async Task<AgentSession> CreateAsync(
        Guid agentId, Guid repoId, string repoPath, string prompt, string logPath, CancellationToken cancellationToken)
    {
        var session = new AgentSession
        {
            Id = Guid.NewGuid(),
            AgentId = agentId,
            RepoId = repoId,
            RepoPath = repoPath,
            Prompt = prompt,
            Status = SessionStatus.Running,
            LogPath = logPath,
            StartedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Sessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);
        return session;
    }

    public async Task<AgentSession?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
        => await db.Sessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public async Task<IReadOnlyList<AgentSession>> GetForAgentAsync(Guid agentId, CancellationToken cancellationToken)
        => await db.Sessions.AsNoTracking()
            .Where(s => s.AgentId == agentId)
            .OrderByDescending(s => s.StartedAtUtc)
            .ToListAsync(cancellationToken);

    public async Task SetRunningAsync(Guid id, int processId, CancellationToken cancellationToken)
    {
        AgentSession? session = await db.Sessions.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (session is null)
        {
            return;
        }

        session.ProcessId = processId;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task CompleteAsync(Guid id, SessionStatus status, int? exitCode, CancellationToken cancellationToken)
    {
        AgentSession? session = await db.Sessions.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (session is null)
        {
            return;
        }

        session.Status = status;
        session.ExitCode = exitCode;
        session.EndedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}
