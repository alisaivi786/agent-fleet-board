import { useEffect, useState } from 'react';
import { fetchAgents } from './api';
import type { AgentStatus } from './types';
import { AgentCard } from './components/AgentCard';

const POLL_INTERVAL_MS = 5000;

export default function App() {
  const [agents, setAgents] = useState<AgentStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const data = await fetchAgents(controller.signal);
        if (!cancelled) {
          setAgents(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Failed to load agents');
        }
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const idleCount = agents?.filter((a) => a.isClean && a.aheadOfBase === 0 && !a.error).length ?? 0;
  const workingCount = agents?.filter((a) => (!a.isClean || a.aheadOfBase > 0) && !a.error).length ?? 0;
  const changedFileCount = agents?.reduce((sum, a) => sum + a.changedFiles.length, 0) ?? 0;

  return (
    <div className="wrap">
      <header className="top">
        <h1>Agent Fleet Board</h1>
        <span className="repo-tag">live · polling every {POLL_INTERVAL_MS / 1000}s</span>
      </header>
      <p className="sub">Real-time git status for every configured agent working tree.</p>

      {error && <div className="error-banner">{error}</div>}

      {!agents ? (
        <p className="loading">Loading fleet status…</p>
      ) : agents.length === 0 ? (
        <p className="loading">
          No agents configured yet. Add entries under <code>AgentFleet:Agents</code> in{' '}
          <code>backend/appsettings.Local.json</code>.
        </p>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <div className="num">{agents.length}</div>
              <div className="label">Agents configured</div>
            </div>
            <div className="stat">
              <div className="num">{idleCount}</div>
              <div className="label">Idle</div>
            </div>
            <div className="stat">
              <div className="num">{workingCount}</div>
              <div className="label">Working</div>
            </div>
            <div className="stat">
              <div className="num">{changedFileCount}</div>
              <div className="label">Uncommitted files</div>
            </div>
          </div>

          <p className="section-label">Roster</p>
          <div className="roster">
            {agents.map((agent) => (
              <AgentCard agent={agent} key={agent.name} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
