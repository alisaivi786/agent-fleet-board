import { useCallback, useEffect, useState } from 'react';
import { fetchActivity, fetchAgents, fetchProjects, fetchRepos } from './api';
import type { AgentStatus, Project, RepoDefinition, SessionActivity } from './types';
import { Sidebar, type Tab } from './components/Sidebar';
import { ProjectShowcase } from './components/ProjectShowcase';
import { AgentMapPage } from './pages/AgentMapPage';
import { DashboardPage } from './pages/DashboardPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { AgentsPage } from './pages/AgentsPage';
import { ActivityPage, type ActivityFilter } from './pages/ActivityPage';
import { ManagePage } from './pages/ManagePage';
import { CustomSelect } from './components/CustomSelect';
import { MoonIcon, PauseIcon, PlayIcon, SunIcon } from './icons';

const POLL_OPTIONS_MS = [2000, 5000, 10000, 30000, 60000];
const THEME_STORAGE_KEY = 'afb-theme';

type Theme = 'light' | 'dark';

const TAB_TITLES: Record<Tab, string> = {
  dashboard: 'Dashboard',
  repositories: 'Repositories',
  agents: 'Agents',
  'agent-map': 'Agent Map',
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
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [activityFilterRequestId, setActivityFilterRequestId] = useState(0);

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

  function openActivity(filter: ActivityFilter = 'all') {
    setActivityFilter(filter);
    setActivityFilterRequestId((id) => id + 1);
    setTab('activity');
  }

  function selectTab(nextTab: Tab) {
    if (nextTab === 'activity') {
      setActivityFilter('all');
      setActivityFilterRequestId((id) => id + 1);
    }
    setTab(nextTab);
  }

  const loading = !agents || !repos || !projects || !activity;
  const backendStatus = error ? 'down' : pollActive ? 'live' : 'paused';

  return (
    <div className="app-shell">
      <Sidebar tab={tab} onSelect={selectTab} />
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
              <CustomSelect
                className="poll-select"
                value={String(pollIntervalMs)}
                onChange={(value) => setPollIntervalMs(Number(value))}
                title="Poll interval"
                options={POLL_OPTIONS_MS.map((ms) => ({ value: String(ms), label: `${ms / 1000}s` }))}
              />
              <span className={`backend-status ${backendStatus}`}>
                <span />
                {backendStatus}
              </span>
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
            <DashboardPage
              agents={agents}
              repos={repos}
              activity={activity}
              onChange={refetch}
              onNavigate={setTab}
              onOpenActivity={openActivity}
            />
          ) : tab === 'repositories' ? (
            <RepositoriesPage repos={repos} agents={agents} />
          ) : tab === 'agents' ? (
            <AgentsPage agents={agents} repos={repos} onChange={refetch} />
          ) : tab === 'agent-map' ? (
            <AgentMapPage projects={projects} agents={agents} activity={activity} />
          ) : tab === 'projects' ? (
            <ProjectShowcase projects={projects} agents={agents} activity={activity} />
          ) : tab === 'activity' ? (
            <ActivityPage
              activity={activity}
              initialFilter={activityFilter}
              filterRequestId={activityFilterRequestId}
            />
          ) : (
            <ManagePage agents={agents} repos={repos} projects={projects} onChange={refetch} />
          )}
        </div>
      </div>
    </div>
  );
}
