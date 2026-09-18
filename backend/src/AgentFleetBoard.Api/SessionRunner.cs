using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
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
        // FileShare.ReadWrite (not StreamWriter's default FileShare.Read) so the log-tail endpoint
        // can open the same path for reading while this writer is still live - otherwise every
        // poll during a running session hits a Win32 sharing-violation IOException.
        var logStream = new FileStream(logPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
        var logWriter = new StreamWriter(logStream) { AutoFlush = true };

        ProcessStartInfo startInfo = BuildStartInfo();
        startInfo.WorkingDirectory = repoPath;
        startInfo.RedirectStandardInput = true;
        startInfo.RedirectStandardOutput = true;
        startInfo.RedirectStandardError = true;
        startInfo.UseShellExecute = false;

        var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        var runningProcess = new RunningProcess(process, logWriter);
        process.OutputDataReceived += (_, e) => WriteLine(runningProcess, e.Data);
        process.ErrorDataReceived += (_, e) => WriteLine(runningProcess, e.Data);
        process.Exited += (_, _) => OnExited(sessionId, runningProcess);

        process.Start();
        // The prompt is delivered over stdin, never as part of the cmd.exe command line above -
        // see BuildStartInfo's doc comment for why that matters.
        process.StandardInput.Write(prompt);
        process.StandardInput.Close();
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

    /// <summary>
    /// `claude` is typically an npm-installed shim (`claude.cmd`/`claude.ps1` on Windows), not a
    /// bare `.exe`. `Process.Start` with `UseShellExecute = false` uses CreateProcess directly,
    /// which - unlike a real shell - does not search PATHEXT or resolve `.cmd`/`.bat` shims by a
    /// bare name; that's exactly the "cannot find the file specified" Win32Exception this fixes.
    /// Routing through `cmd.exe /c` resolves PATH and PATHEXT the same way a terminal typing
    /// `claude` would - but the command line built here is fixed and never includes the prompt:
    /// letting cmd.exe re-parse untrusted text as part of its own command grammar (`&`, `|`, `%`,
    /// `^`, ...) would be a command-injection surface. The prompt is delivered over stdin instead
    /// (see Start()), which cmd.exe/claude never interpret as command syntax.
    /// </summary>
    private static ProcessStartInfo BuildStartInfo()
    {
        bool isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
        var info = new ProcessStartInfo(isWindows ? "cmd.exe" : "claude");

        if (isWindows)
        {
            info.ArgumentList.Add("/c");
            info.ArgumentList.Add("claude");
        }

        info.ArgumentList.Add("-p");
        return info;
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
