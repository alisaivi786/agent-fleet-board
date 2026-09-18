using System.Diagnostics;

namespace AgentFleetBoard.Api.Services;

public sealed record WorktreeInfo(string Path, string? Branch);

public interface IWorktreeScanner
{
    /// <summary>
    /// Runs `git worktree list --porcelain` against <paramref name="repoPath"/> and returns every
    /// *linked* worktree - the main worktree at <paramref name="repoPath"/> itself is excluded, since
    /// that's already the registered repo, not something to discover. Returns an empty list if
    /// <paramref name="repoPath"/> isn't a git working tree or the command fails.
    /// </summary>
    Task<IReadOnlyList<WorktreeInfo>> ListLinkedWorktreesAsync(string repoPath, CancellationToken cancellationToken);
}

/// <summary>
/// Backs "connect a repo, auto-discover its agents": most of this tool's real usage has one agent
/// per git worktree under a shared repo (e.g. Claude Code's own `.claude/worktrees/&lt;name&gt;`
/// convention) rather than one agent per hand-registered repo entry. Shells out to the system `git`
/// binary only, same as GitStatusReader - never a client-supplied path beyond the registry-resolved
/// repo path.
/// </summary>
public sealed class WorktreeScanner(ILogger<WorktreeScanner> logger) : IWorktreeScanner
{
    public async Task<IReadOnlyList<WorktreeInfo>> ListLinkedWorktreesAsync(string repoPath, CancellationToken cancellationToken)
    {
        string? stdOut = await RunAsync(repoPath, cancellationToken);
        if (stdOut is null)
        {
            return [];
        }

        var results = new List<WorktreeInfo>();
        string? currentPath = null;
        string? currentBranch = null;

        void Flush()
        {
            if (currentPath is not null && !PathsEqual(currentPath, repoPath))
            {
                results.Add(new WorktreeInfo(currentPath, currentBranch));
            }
        }

        foreach (string line in stdOut.Split('\n'))
        {
            string trimmed = line.TrimEnd('\r');
            if (trimmed.Length == 0)
            {
                Flush();
                currentPath = null;
                currentBranch = null;
                continue;
            }

            if (trimmed.StartsWith("worktree ", StringComparison.Ordinal))
            {
                currentPath = trimmed["worktree ".Length..];
            }
            else if (trimmed.StartsWith("branch ", StringComparison.Ordinal))
            {
                string full = trimmed["branch ".Length..];
                currentBranch = full.StartsWith("refs/heads/", StringComparison.Ordinal) ? full["refs/heads/".Length..] : full;
            }
        }

        Flush();
        return results;
    }

    private static bool PathsEqual(string a, string b) =>
        string.Equals(Path.GetFullPath(a).TrimEnd('\\', '/'), Path.GetFullPath(b).TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase);

    private async Task<string?> RunAsync(string repoPath, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo("git")
        {
            WorkingDirectory = repoPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        startInfo.ArgumentList.Add("worktree");
        startInfo.ArgumentList.Add("list");
        startInfo.ArgumentList.Add("--porcelain");

        try
        {
            using var process = new Process { StartInfo = startInfo };
            process.Start();
            string stdOut = await process.StandardOutput.ReadToEndAsync(cancellationToken);
            await process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);
            return process.ExitCode == 0 ? stdOut : null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "git worktree list failed in {Path}", repoPath);
            return null;
        }
    }
}
