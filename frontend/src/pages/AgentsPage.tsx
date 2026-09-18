import { useState } from 'react';
import type { AgentStatus, RepoDefinition } from '../types';
import { isIdle, isWorking } from '../agentStatus';
import { AgentCard } from '../components/AgentCard';

type StatusFilter = 'all' | 'idle' | 'working' | 'error';

export function AgentsPage({
  agents,
  repos,
  onChange,
}: {
  agents: AgentStatus[];
  repos: RepoDefinition[];
  onChange: () => void;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const idleCount = agents.filter(isIdle).length;
  const workingCount = agents.filter(isWorking).length;
  const changedFileCount = agents.reduce((sum, a) => sum + a.changedFiles.length, 0);

  const filteredAgents = agents.filter((agent) => {
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
  });

  if (agents.length === 0) {
    return (
      <p className="loading">
        No agents configured yet. Switch to the <strong>Manage</strong> tab to register a repo and create an
        agent.
      </p>
    );
  }

  return (
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
          <div className="label">Diverged</div>
        </button>
        <div className="stat">
          <div className="num">{changedFileCount}</div>
          <div className="label">Uncommitted files</div>
        </div>
      </div>

      <div className="roster-toolbar">
        <p className="section-label">
          Roster{filteredAgents.length !== agents.length ? ` (${filteredAgents.length} of ${agents.length})` : ''}
        </p>
        <input
          className="roster-search"
          type="search"
          placeholder="Filter by name, role, repo, or branch…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filteredAgents.length === 0 ? (
        <p className="loading">No agents match this filter.</p>
      ) : (
        <div className="roster">
          {filteredAgents.map((agent) => (
            <AgentCard agent={agent} repos={repos} onChange={onChange} key={agent.id} />
          ))}
        </div>
      )}
    </>
  );
}
