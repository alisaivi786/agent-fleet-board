using System.Diagnostics;
using System.Globalization;
using AgentFleetBoard.Api.Models;
using AgentFleetBoard.Api.Options;

namespace AgentFleetBoard.Api.Services;

public interface IGitStatusReader
{
    Task<AgentStatus> ReadAsync(AgentDefinition agent, CancellationToken cancellationToken);
}

/// <summary>
/// Shells out to the system `git` binary to read status for a configured, server-side path only.
/// Paths always come from appsettings, never from a request - never wire a client-supplied path
/// into this reader, or it becomes an arbitrary-command/path-traversal primitive.
/// </summary>
public sealed class GitStatusReader(ILogger<GitStatusReader> logger) : IGitStatusReader
{
    public async Task<AgentStatus> ReadAsync(AgentDefinition agent, CancellationToken cancellationToken)
    {
        if (!Directory.Exists(agent.RepoPath))
        {
            return new AgentStatus(
                agent.Name, agent.Role, agent.RepoPath, null,
                PathExists: false, IsGitRepo: false, IsClean: true, [],
                null, null, null, 0, 0, "Path does not exist.");
        }

        if (await RunAsync(agent.RepoPath, ["rev-parse", "--is-inside-work-tree"], cancellationToken) is not { ExitCode: 0 })
        {
            return new AgentStatus(
                agent.Name, agent.Role, agent.RepoPath, null,
                PathExists: true, IsGitRepo: false, IsClean: true, [],
                null, null, null, 0, 0, "Not a git working tree.");
        }

        string? branch = (await RunAsync(agent.RepoPath, ["branch", "--show-current"], cancellationToken))?.StdOut.Trim();

        GitResult? statusResult = await RunAsync(agent.RepoPath, ["status", "--porcelain=v1"], cancellationToken);
        IReadOnlyList<string> changedFiles = statusResult?.StdOut
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(line => line.Length > 3 ? line[3..] : line)
            .ToList() ?? [];

        GitResult? logResult = await RunAsync(
            agent.RepoPath, ["log", "-1", "--format=%h%s%cI"], cancellationToken);
        string? hash = null, message = null;
        DateTimeOffset? date = null;
        if (logResult is { ExitCode: 0 } && logResult.StdOut.Trim().Split('') is [string h, string m, string d])
        {
            hash = h;
            message = m;
            date = DateTimeOffset.TryParse(d, CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTimeOffset parsed)
                ? parsed
                : null;
        }

        (int ahead, int behind) = await ReadAheadBehindAsync(agent, cancellationToken);

        return new AgentStatus(
            agent.Name, agent.Role, agent.RepoPath, branch,
            PathExists: true, IsGitRepo: true, IsClean: changedFiles.Count == 0, changedFiles,
            hash, message, date, ahead, behind, Error: null);
    }

    private async Task<(int Ahead, int Behind)> ReadAheadBehindAsync(AgentDefinition agent, CancellationToken cancellationToken)
    {
        string baseRef = $"origin/{agent.BaseBranch}";
        GitResult? result = await RunAsync(
            agent.RepoPath, ["rev-list", "--left-right", "--count", $"{baseRef}...HEAD"], cancellationToken);
        if (result is not { ExitCode: 0 })
        {
            return (0, 0);
        }

        string[] parts = result.StdOut.Trim().Split('\t', StringSplitOptions.TrimEntries);
        if (parts.Length != 2
            || !int.TryParse(parts[0], out int behind)
            || !int.TryParse(parts[1], out int ahead))
        {
            return (0, 0);
        }

        return (ahead, behind);
    }

    private async Task<GitResult?> RunAsync(string workingDirectory, string[] arguments, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo("git")
        {
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (string arg in arguments)
        {
            startInfo.ArgumentList.Add(arg);
        }

        try
        {
            using var process = new Process { StartInfo = startInfo };
            process.Start();
            string stdOut = await process.StandardOutput.ReadToEndAsync(cancellationToken);
            string stdErr = await process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);
            return new GitResult(process.ExitCode, stdOut, stdErr);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "git {Args} failed in {Path}", string.Join(' ', arguments), workingDirectory);
            return null;
        }
    }

    private sealed record GitResult(int ExitCode, string StdOut, string StdErr);
}
