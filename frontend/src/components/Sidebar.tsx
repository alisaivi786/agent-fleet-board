import { ActivityIcon, AgentMapIcon, AgentsIcon, DashboardIcon, ProjectsIcon, RepoIcon, SettingsIcon } from '../icons';

export type Tab = 'dashboard' | 'repositories' | 'agents' | 'agent-map' | 'projects' | 'activity' | 'manage';

const NAV_ITEMS: { tab: Tab; label: string; icon: (props: { size?: number }) => React.ReactElement }[] = [
  { tab: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { tab: 'repositories', label: 'Repositories', icon: RepoIcon },
  { tab: 'agents', label: 'Agents', icon: AgentsIcon },
  { tab: 'agent-map', label: 'Agent Map', icon: AgentMapIcon },
  { tab: 'projects', label: 'Projects', icon: ProjectsIcon },
  { tab: 'activity', label: 'Activity', icon: ActivityIcon },
  { tab: 'manage', label: 'Manage', icon: SettingsIcon },
];

export function Sidebar({ tab, onSelect }: { tab: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">AF</div>
        <div>
          <div className="sidebar-title">Agent Fleet Board</div>
          <div className="sidebar-subtitle">Multi-agent dev, in parallel</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ tab: itemTab, label, icon: Icon }) => (
          <button
            type="button"
            key={itemTab}
            className={itemTab === tab ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
            onClick={() => onSelect(itemTab)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
