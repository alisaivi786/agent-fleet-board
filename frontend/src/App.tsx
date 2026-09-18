import { useCallback, useEffect, useState } from 'react';
import { fetchAgents, fetchRepos } from './api';
import type { AgentStatus, RepoDefinition } from './types';
import { AgentCard } from './components/AgentCard';
import { RepoManager } from './components/RepoManager';
import { AgentManager } from './components/AgentManager';

const POLL_INTERVAL_MS = 5000;

type Tab = 'roster' | 'manage';

export default function App() {
  const [tab, setTab] = useState<Tab>('roster');
  const [agents, setAgents] = useState<AgentStatus[] | null>(null);
  const [repos, setRepos] = useState<RepoDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (signal?: AbortSignal) => {
    try {
      const [agentData, repoData] = await Promise.all([fetchAgents(signal), fetchRepos(signal)]);
      setAgents(agentData);
      setRepos(repoData);
      setError(null);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Failed to load fleet data');
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      if (!cancelled) {
        await refetch(controller.signal);
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [refetch]);

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

      <div className="tab-row">
        <button className={tab === 'roster' ? 'tab active' : 'tab'} onClick={() => setTab('roster')}>
          Roster
        </button>
        <button className={tab === 'manage' ? 'tab active' : 'tab'} onClick={() => setTab('manage')}>
          Manage
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {tab === 'roster' ? (
        !agents ? (
          <p className="loading">Loading fleet status…</p>
        ) : agents.length === 0 ? (
          <p className="loading">
            No agents configured yet. Switch to the <strong>Manage</strong> tab to register a repo and
            create an agent.
          </p>
        ) : !repos ? (
          <p className="loading">Loading registry…</p>
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
                <AgentCard agent={agent} repos={repos} onChange={refetch} key={agent.id} />
              ))}
            </div>
          </>
        )
      ) : !agents || !repos ? (
        <p className="loading">Loading registry…</p>
      ) : (
        <>
          <RepoManager repos={repos} onChange={refetch} />
          <AgentManager agents={agents} repos={repos} onChange={refetch} />
        </>
      )}
    </div>
  );
}
