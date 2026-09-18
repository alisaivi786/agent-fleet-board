import { useState } from 'react';
import type { AgentStatus } from '../types';
import { avatarColor } from '../colors';
import { preparePrompt } from '../api';
import { SessionPanel } from './SessionPanel';

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function AgentCard({ agent }: { agent: AgentStatus }) {
  const working = !agent.isClean || agent.aheadOfBase > 0;
  const initial = agent.name.charAt(0).toUpperCase();

  const [promptOpen, setPromptOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [command, setCommand] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handlePrepare(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPromptError(null);
    setCopied(false);
    try {
      const result = await preparePrompt(agent.id, prompt);
      setCommand(result.command);
    } catch (err) {
      setCommand(null);
      setPromptError(err instanceof Error ? err.message : 'Failed to prepare command');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="avatar" style={{ background: avatarColor(agent.name) }}>
          {initial}
        </div>
        <div>
          <div className="card-name">{agent.name}</div>
          <div className="card-role">{agent.role}</div>
        </div>
        {agent.error ? (
          <span className="pill warn">
            <span className="dot" />
            Unreachable
          </span>
        ) : working ? (
          <span className="pill working">
            <span className="dot" />
            Working
          </span>
        ) : (
          <span className="pill idle">
            <span className="dot" />
            Idle
          </span>
        )}
      </div>

      {agent.error ? (
        <p className="card-error">{agent.error}</p>
      ) : (
        <div className="kv">
          <div className="kv-row">
            <span className="k">Branch</span>
            <span className="v">
              <span className="branch-chip">{agent.branch ?? '—'}</span>
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Last commit</span>
            <span className="v">{agent.lastCommitMessage ?? '—'}</span>
          </div>
          <div className="kv-row">
            <span className="k">Committed</span>
            <span className="v">{relativeTime(agent.lastCommitDate)}</span>
          </div>
          <div className="kv-row">
            <span className="k">vs. base</span>
            <span className="v">
              {agent.aheadOfBase} ahead · {agent.behindBase} behind
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Working tree</span>
            <span className="v">{agent.isClean ? 'clean' : `${agent.changedFiles.length} changed`}</span>
          </div>
        </div>
      )}

      {agent.repoPath && (
        <div className="worktree-path" title={agent.repoPath}>
          {agent.repoPath}
        </div>
      )}

      {agent.changedFiles.length > 0 && (
        <div className="swap-strip">
          {agent.changedFiles.slice(0, 6).map((file) => (
            <span className="tag" key={file}>
              {file}
            </span>
          ))}
          {agent.changedFiles.length > 6 && <span className="tag">+{agent.changedFiles.length - 6} more</span>}
        </div>
      )}

      <div className="card-actions">
        <button
          type="button"
          className="prompt-toggle"
          onClick={() => setPromptOpen((open) => !open)}
          disabled={!agent.repoId}
          title={agent.repoId ? undefined : 'Assign a repo first'}
        >
          {promptOpen ? 'Close' : 'Prompt'}
        </button>
        <button
          type="button"
          className="prompt-toggle run-toggle"
          onClick={() => setRunOpen((open) => !open)}
          disabled={!agent.repoId}
          title={agent.repoId ? undefined : 'Assign a repo first'}
        >
          {runOpen ? 'Close' : 'Run'}
        </button>
      </div>

      {promptOpen && (
        <form className="prompt-box" onSubmit={handlePrepare}>
          <textarea
            placeholder="What should this agent do?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            Prepare command
          </button>
          {promptError && <div className="error-banner">{promptError}</div>}
          {command && (
            <div className="prompt-command">
              <code>{command}</code>
              <button type="button" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </form>
      )}

      {runOpen && <SessionPanel agentId={agent.id} repoName={agent.repoName} />}
    </div>
  );
}
