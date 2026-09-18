import { useEffect, useMemo, useState } from 'react';
import { fetchSessionLog } from '../api';
import type { SessionActivity, SessionStatus } from '../types';

export type ActivityFilter = 'all' | SessionStatus;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null, startedAt: string): string {
  const elapsedMs = ms ?? Date.now() - new Date(startedAt).getTime();
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function statusClass(status: SessionStatus): string {
  if (status === 'Running') return 'working';
  if (status === 'Failed') return 'warn';
  if (status === 'Stopped') return 'stopped';
  return 'idle';
}

function statusText(entry: SessionActivity): string {
  if (entry.status === 'Failed' && entry.exitCode !== null) return `Failed / exit ${entry.exitCode}`;
  return entry.status;
}

function compactPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 3) return path;
  return `${parts.at(-3)} / ${parts.at(-2)} / ${parts.at(-1)}`;
}

export function ActivityPage({
  activity,
  initialFilter = 'all',
  filterRequestId,
}: {
  activity: SessionActivity[];
  initialFilter?: ActivityFilter;
  filterRequestId: number;
}) {
  const [filter, setFilter] = useState<ActivityFilter>(initialFilter);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [logsById, setLogsById] = useState<Record<string, string>>({});
  const [logErrorsById, setLogErrorsById] = useState<Record<string, string>>({});
  const [loadingLogId, setLoadingLogId] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      total: activity.length,
      running: activity.filter((entry) => entry.status === 'Running').length,
      failed: activity.filter((entry) => entry.status === 'Failed').length,
      stopped: activity.filter((entry) => entry.status === 'Stopped').length,
    }),
    [activity],
  );

  const filtered = activity.filter((entry) => {
    if (filter !== 'all' && entry.status !== filter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      entry.agentName.toLowerCase().includes(q) ||
      (entry.agentRole ?? '').toLowerCase().includes(q) ||
      (entry.repoName ?? '').toLowerCase().includes(q) ||
      entry.repoPath.toLowerCase().includes(q) ||
      (entry.projectName ?? '').toLowerCase().includes(q) ||
      entry.prompt.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setFilter(initialFilter);
    if (initialFilter === 'all') return;
    const firstMatch = activity.find((entry) => entry.status === initialFilter);
    if (firstMatch) {
      void openDetails(firstMatch.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRequestId]);

  async function openDetails(id: string) {
    setOpenId((current) => (current === id ? null : id));
    if (logsById[id] !== undefined || loadingLogId === id) return;

    setLoadingLogId(id);
    try {
      const result = await fetchSessionLog(id);
      setLogsById((current) => ({ ...current, [id]: result.log }));
      setLogErrorsById((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch (err) {
      setLogErrorsById((current) => ({
        ...current,
        [id]: err instanceof Error ? err.message : 'Failed to load session log',
      }));
    } finally {
      setLoadingLogId((current) => (current === id ? null : current));
    }
  }

  const filters: { value: ActivityFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All runs', count: stats.total },
    { value: 'Running', label: 'Running', count: stats.running },
    { value: 'Failed', label: 'Failed', count: stats.failed },
    { value: 'Stopped', label: 'Stopped', count: stats.stopped },
  ];

  return (
    <div className="activity-page">
      <div className="activity-summary">
        <div className="activity-summary-card">
          <span className="activity-summary-label">Total sessions</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="activity-summary-card">
          <span className="activity-summary-label">Running now</span>
          <strong>{stats.running}</strong>
        </div>
        <div className="activity-summary-card">
          <span className="activity-summary-label">Failed</span>
          <strong>{stats.failed}</strong>
        </div>
        <div className="activity-summary-card">
          <span className="activity-summary-label">Stopped</span>
          <strong>{stats.stopped}</strong>
        </div>
      </div>

      <div className="activity-console">
        <div className="activity-console-head">
          <div>
            <div className="panel-title">Session Log</div>
            <p className="activity-console-subtitle">
              Recent agent runs with prompt, repo, status, timing, and project context.
            </p>
          </div>
          <input
            className="roster-search activity-search"
            type="search"
            placeholder="Search agent, repo, project, or prompt..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="activity-filter-row">
          {filters.map((item) => (
            <button
              type="button"
              key={item.value}
              className={filter === item.value ? 'activity-filter active' : 'activity-filter'}
              onClick={() => setFilter(item.value)}
            >
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="loading">No activity matches this filter.</p>
        ) : (
          <div className="activity-log-list">
            {filtered.map((entry) => (
              <article className="activity-log-row" key={entry.id}>
                <div className={`activity-status-rail ${statusClass(entry.status)}`} />
                <div className="activity-log-main">
                  <div className="activity-log-topline">
                    <div className="activity-agent-block">
                      <span className="activity-agent-name">{entry.agentName}</span>
                      <span className="activity-agent-role">{entry.agentRole ?? 'Agent'}</span>
                    </div>
                    <span className={`pill ${statusClass(entry.status)}`}>
                      <span className="dot" />
                      {statusText(entry)}
                    </span>
                  </div>

                  <p className="activity-prompt">{entry.prompt}</p>

                  <div className="activity-meta-grid">
                    <div>
                      <span>Repo</span>
                      <strong>{entry.repoName ?? 'Unknown repo'}</strong>
                    </div>
                    <div>
                      <span>Project</span>
                      <strong>{entry.projectName ?? 'Unassigned'}</strong>
                    </div>
                    <div>
                      <span>Started</span>
                      <strong title={absoluteTime(entry.startedAtUtc)}>
                        {relativeTime(entry.startedAtUtc)}
                      </strong>
                    </div>
                    <div>
                      <span>Duration</span>
                      <strong>{formatDuration(entry.durationMs, entry.startedAtUtc)}</strong>
                    </div>
                  </div>

                  <div className="activity-path" title={entry.repoPath}>
                    {compactPath(entry.repoPath)}
                  </div>

                  <div className="activity-row-actions">
                    <button type="button" className="btn-secondary" onClick={() => openDetails(entry.id)}>
                      {openId === entry.id ? 'Hide log' : entry.status === 'Failed' ? 'Check failure' : 'View log'}
                    </button>
                  </div>

                  {openId === entry.id && (
                    <div className="activity-log-detail">
                      <div className="session-log-titlebar">
                        <span>Captured output</span>
                        <span>{entry.id.slice(0, 8)}</span>
                      </div>
                      {logErrorsById[entry.id] ? (
                        <div className="error-banner">{logErrorsById[entry.id]}</div>
                      ) : (
                        <pre className="session-log">
                          {loadingLogId === entry.id
                            ? 'Loading log...'
                            : logsById[entry.id] || '(no output captured)'}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
