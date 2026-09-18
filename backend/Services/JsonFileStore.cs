using System.Text.Json;

namespace AgentFleetBoard.Api.Services;

/// <summary>
/// Minimal persisted-list store backing the repo/agent registries: reads and rewrites a whole JSON
/// array file under a single lock. This is a single-process local tool, so a semaphore around a
/// read-modify-write is enough - no need for anything fancier.
/// </summary>
internal sealed class JsonFileStore<T>(string filePath)
{
    private static readonly JsonSerializerOptions SerializerOptions = new() { WriteIndented = true };
    private readonly SemaphoreSlim _lock = new(1, 1);

    public async Task<List<T>> ReadAllAsync(CancellationToken cancellationToken)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            return await ReadAllUnlockedAsync(cancellationToken);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<TResult> MutateAsync<TResult>(Func<List<T>, TResult> mutate, CancellationToken cancellationToken)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            List<T> items = await ReadAllUnlockedAsync(cancellationToken);
            TResult result = mutate(items);
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
            await File.WriteAllTextAsync(filePath, JsonSerializer.Serialize(items, SerializerOptions), cancellationToken);
            return result;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<List<T>> ReadAllUnlockedAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(filePath))
        {
            return [];
        }

        string json = await File.ReadAllTextAsync(filePath, cancellationToken);
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        return JsonSerializer.Deserialize<List<T>>(json) ?? [];
    }
}
