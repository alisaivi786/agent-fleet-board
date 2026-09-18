import { useCallback, useEffect, useState } from 'react';
import { fetchAgents, fetchRepos } from './api';
import type { AgentStatus, RepoDefinition } from './types';
import { AgentCard } from './components/AgentCard';
import { RepoManager } from './components/RepoManager';
import { AgentManager } from './components/AgentManager';
import { MoonIcon, PauseIcon, PlayIcon, SunIcon } from './icons';

const POLL_OPTIONS_MS = [2000, 5000, 10000, 30000, 60000];
const THEME_STORAGE_KEY = 'afb-theme';

type Tab = 'roster' | 'manage';
type StatusFilter = 'all' | 'idle' | 'working' | 'error';
type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable - fall through to system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function isIdle(agent: AgentStatus): boolean {
  return !agent.error && agent.isClean && agent.aheadOfBase === 0;
}

function isWorking(agent: AgentStatus): boolean {
  return !agent.error && (!agent.isClean || agent.aheadOfBase > 0);
}

export default function App() {
  const [tab, setTab] = useState<Tab>('roster');
  const [agents, setAgents] = useState<AgentStatus[] | null>(null);
  const [repos, setRepos] = useState<RepoDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [pollIntervalMs, setPollIntervalMs] = useState(5000);
  const [pollActive, setPollActive] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Best-effort persistence only - the toggle still works for this session either way.
    }
  }, [theme]);

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
    const controller = new AbortController();
    refetch(controller.signal);
    return () => controller.abort();
  }, [refetch]);

  useEffect(() => {
    if (!pollActive) return;
    const controller = new AbortController();
    const interval = setInterval(() => refetch(controller.signal), pollIntervalMs);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [refetch, pollIntervalMs, pollActive]);

  function togglePolling() {
    const next = !pollActive;
    setPollActive(next);
    if (next) refetch();
  }

  const idleCount = agents?.filter(isIdle).length ?? 0;
  const workingCount = agents?.filter(isWorking).length ?? 0;
  const changedFileCount = agents?.reduce((sum, a) => sum + a.changedFiles.length, 0) ?? 0;

  const filteredAgents =
    agents?.filter((agent) => {
      if (statusFilter === 'idle' && !isIdle(agent)) return false;
      if (statusFilter === 'working' && !isWorking(agent)) return false;
      if (statusFilter === 'error' && !agent.error) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.role.toLowerCase().includes(q) ||
        (agent.repoName ?? '').toLowerCase().includes(q) ||
        (agent.branch ?? '').toLowerCase().includes(q)
      );
    }) ?? null;

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>Agent Fleet Board</h1>
          <p className="sub">Real-time git status for every configured agent working tree.</p>
        </div>
        <div className="top-controls">
          <div className="poll-control">
            <button
              type="button"
              className="icon-btn"
              onClick={togglePolling}
              title={pollActive ? 'Pause polling' : 'Resume polling'}
            >
              {pollActive ? <PauseIcon /> : <PlayIcon />}
            </button>
            <select
              className="poll-select"
              value={pollIntervalMs}
              onChange={(e) => setPollIntervalMs(Number(e.target.value))}
              title="Poll interval"
            >
              {POLL_OPTIONS_MS.map((ms) => (
                <option value={ms} key={ms}>
                  every {ms / 1000}s
                </option>
              ))}
            </select>
            <span className="repo-tag">{pollActive ? 'live' : 'paused'}</span>
          </div>
          <button
            type="button"
            className="icon-btn theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

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
              <button
                type="button"
                className={`stat stat-filter ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                <div className="num">{agents.length}</div>
                <div className="label">Agents configured</div>
              </button>
              <button
                type="button"
                className={`stat stat-filter ${statusFilter === 'idle' ? 'active' : ''}`}
                onClick={() => setStatusFilter((f) => (f === 'idle' ? 'all' : 'idle'))}
              >
                <div className="num">{idleCount}</div>
                <div className="label">Idle</div>
              </button>
              <button
                type="button"
                className={`stat stat-filter ${statusFilter === 'working' ? 'active' : ''}`}
                onClick={() => setStatusFilter((f) => (f === 'working' ? 'all' : 'working'))}
              >
                <div className="num">{workingCount}</div>
                <div className="label">Working</div>
              </button>
              <div className="stat">
                <div className="num">{changedFileCount}</div>
                <div className="label">Uncommitted files</div>
              </div>
            </div>

            <div className="roster-toolbar">
              <p className="section-label">
                Roster{filteredAgents && filteredAgents.length !== agents.length ? ` (${filteredAgents.length} of ${agents.length})` : ''}
              </p>
              <input
                className="roster-search"
                type="search"
                placeholder="Filter by name, role, repo, or branch…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {filteredAgents && filteredAgents.length === 0 ? (
              <p className="loading">No agents match this filter.</p>
            ) : (
              <div className="roster">
                {filteredAgents?.map((agent) => (
                  <AgentCard agent={agent} repos={repos} onChange={refetch} key={agent.id} />
                ))}
              </div>
            )}
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
