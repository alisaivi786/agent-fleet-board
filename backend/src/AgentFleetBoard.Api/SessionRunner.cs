using System.Collections.Concurrent;
using System.Diagnostics;
using AgentFleetBoard.Domain;
using AgentFleetBoard.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AgentFleetBoard.Api.Services;

public interface ISessionRunner
{
    /// <summary>Spawns the configured CLI against <paramref name="repoPath"/> and returns its OS process id.</summary>
    int Start(Guid sessionId, string repoPath, string prompt, string logPath);

    /// <summary>Kills the tracked process for <paramref name="sessionId"/>, if still running. Returns false if it wasn't running.</summary>
    bool Stop(Guid sessionId);
}

/// <summary>
/// Spawns a real `claude` subprocess per session - this is the point where the tool's security
/// model changes shape (see CLAUDE.md): the process command/working directory always comes from
/// the registry-resolved repo path, never a client-supplied path, but a client-triggered subprocess
/// spawn is a materially different risk than anything built before this. Running sessions are
/// tracked in-memory only (a restart loses the ability to Stop() them, though their DB row and log
/// file survive) - this is a known v1 limitation, not an oversight.
/// </summary>
public sealed class SessionRunner(IServiceScopeFactory scopeFactory, ILogger<SessionRunner> logger) : ISessionRunner
{
    private readonly ConcurrentDictionary<Guid, RunningProcess> running = new();

    public int Start(Guid sessionId, string repoPath, string prompt, string logPath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(logPath)!);
        var logWriter = new StreamWriter(logPath, append: false) { AutoFlush = true };

        var startInfo = new ProcessStartInfo("claude")
        {
            WorkingDirectory = repoPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        startInfo.ArgumentList.Add("-p");
        startInfo.ArgumentList.Add(prompt);

        var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        var runningProcess = new RunningProcess(process, logWriter);
        process.OutputDataReceived += (_, e) => WriteLine(runningProcess, e.Data);
        process.ErrorDataReceived += (_, e) => WriteLine(runningProcess, e.Data);
        process.Exited += (_, _) => OnExited(sessionId, runningProcess);

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        running[sessionId] = runningProcess;
        return process.Id;
    }

    public bool Stop(Guid sessionId)
    {
        if (!running.TryGetValue(sessionId, out RunningProcess? runningProcess))
        {
            return false;
        }

        runningProcess.StoppedByUser = true;
        try
        {
            runningProcess.Process.Kill(entireProcessTree: true);
            return true;
        }
        catch (InvalidOperationException)
        {
            // Already exited between the lookup and the kill attempt.
            return false;
        }
    }

    private static void WriteLine(RunningProcess runningProcess, string? line)
    {
        if (line is not null)
        {
            runningProcess.LogWriter.WriteLine(line);
        }
    }

    private void OnExited(Guid sessionId, RunningProcess runningProcess)
    {
        running.TryRemove(sessionId, out _);
        runningProcess.LogWriter.Dispose();

        SessionStatus status = runningProcess.StoppedByUser
            ? SessionStatus.Stopped
            : runningProcess.Process.ExitCode == 0 ? SessionStatus.Succeeded : SessionStatus.Failed;

        _ = CompleteAsync(sessionId, status, runningProcess.Process.ExitCode);
    }

    private async Task CompleteAsync(Guid sessionId, SessionStatus status, int exitCode)
    {
        try
        {
            using IServiceScope scope = scopeFactory.CreateScope();
            var registry = scope.ServiceProvider.GetRequiredService<ISessionRegistry>();
            await registry.CompleteAsync(sessionId, status, exitCode, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to record completion for session {SessionId}", sessionId);
        }
    }

    private sealed class RunningProcess(Process process, StreamWriter logWriter)
    {
        public Process Process { get; } = process;

        public StreamWriter LogWriter { get; } = logWriter;

        public bool StoppedByUser { get; set; }
    }
}
