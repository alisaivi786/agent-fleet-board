import type { SessionActivity } from '../types';

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function eventText(entry: SessionActivity): string {
  const repo = entry.repoName ? ` in ${entry.repoName}` : '';
  switch (entry.status) {
    case 'Running':
      return `${entry.agentName} started a session${repo}`;
    case 'Succeeded':
      return `${entry.agentName}'s session succeeded${repo}`;
    case 'Failed':
      return `${entry.agentName}'s session failed${repo}${entry.exitCode !== null ? ` (exit ${entry.exitCode})` : ''}`;
    case 'Stopped':
      return `${entry.agentName}'s session was stopped${repo}`;
  }
}

function dotClass(status: SessionActivity['status']): string {
  switch (status) {
    case 'Running':
      return 'activity-dot-running';
    case 'Succeeded':
      return 'activity-dot-success';
    case 'Failed':
      return 'activity-dot-failed';
    case 'Stopped':
      return 'activity-dot-stopped';
  }
}

export function ActivityFeed({ activity, limit }: { activity: SessionActivity[]; limit?: number }) {
  const items = limit ? activity.slice(0, limit) : activity;

  if (items.length === 0) {
    return <p className="loading">No sessions have run yet.</p>;
  }

  return (
    <ul className="activity-feed">
      {items.map((entry) => (
        <li className="activity-item" key={entry.id}>
          <span className={`activity-dot ${dotClass(entry.status)}`} />
          <span className="activity-text">{eventText(entry)}</span>
          <span className="activity-time">{relativeTime(entry.endedAtUtc ?? entry.startedAtUtc)}</span>
        </li>
      ))}
    </ul>
  );
}
