import { useCallback, useEffect, useState } from 'react';
import { fetchActivity, fetchAgents, fetchProjects, fetchRepos } from './api';
import type { AgentStatus, Project, RepoDefinition, SessionActivity } from './types';
import { Sidebar, type Tab } from './components/Sidebar';
import { ProjectShowcase } from './components/ProjectShowcase';
import { DashboardPage } from './pages/DashboardPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { AgentsPage } from './pages/AgentsPage';
import { ActivityPage } from './pages/ActivityPage';
import { ManagePage } from './pages/ManagePage';
import { MoonIcon, PauseIcon, PlayIcon, SunIcon } from './icons';

const POLL_OPTIONS_MS = [2000, 5000, 10000, 30000, 60000];
const THEME_STORAGE_KEY = 'afb-theme';

type Theme = 'light' | 'dark';

const TAB_TITLES: Record<Tab, string> = {
  dashboard: 'Dashboard',
  repositories: 'Repositories',
  agents: 'Agents',
  projects: 'Projects',
  activity: 'Activity',
  manage: 'Manage',
};

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable - fall through to system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [agents, setAgents] = useState<AgentStatus[] | null>(null);
  const [repos, setRepos] = useState<RepoDefinition[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activity, setActivity] = useState<SessionActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      const [agentData, repoData, projectData, activityData] = await Promise.all([
        fetchAgents(signal),
        fetchRepos(signal),
        fetchProjects(signal),
        fetchActivity(signal),
      ]);
      setAgents(agentData);
      setRepos(repoData);
      setProjects(projectData);
      setActivity(activityData);
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

  const loading = !agents || !repos || !projects || !activity;

  return (
    <div className="app-shell">
      <Sidebar tab={tab} onSelect={setTab} />
      <div className="app-main">
        <header className="top-bar">
          <h1>{TAB_TITLES[tab]}</h1>
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

        <div className="app-content">
          {error && <div className="error-banner">{error}</div>}

          {loading ? (
            <p className="loading">Loading fleet status…</p>
          ) : tab === 'dashboard' ? (
            <DashboardPage agents={agents} repos={repos} projects={projects} activity={activity} onChange={refetch} onNavigate={setTab} />
          ) : tab === 'repositories' ? (
            <RepositoriesPage repos={repos} agents={agents} projects={projects} />
          ) : tab === 'agents' ? (
            <AgentsPage agents={agents} repos={repos} onChange={refetch} />
          ) : tab === 'projects' ? (
            <ProjectShowcase projects={projects} agents={agents} repos={repos} />
          ) : tab === 'activity' ? (
            <ActivityPage activity={activity} />
          ) : (
            <ManagePage agents={agents} repos={repos} projects={projects} onChange={refetch} />
          )}
        </div>
      </div>
    </div>
  );
}
