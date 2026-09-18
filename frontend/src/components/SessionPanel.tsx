import { useEffect, useRef, useState } from 'react';
import { fetchSession, fetchSessionLog, fetchSessions, forceStopSession, preparePrompt, startSession } from '../api';
import type { AgentSession } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

const POLL_INTERVAL_MS = 2000;

function statusLabel(status: AgentSession['status']): string {
  switch (status) {
    case 'Running':
      return 'Running…';
    case 'Succeeded':
      return 'Succeeded';
    case 'Failed':
      return 'Failed';
    case 'Stopped':
      return 'Stopped';
  }
}

export function SessionPanel({ agentId, repoName }: { agentId: string; repoName: string | null }) {
  const [prompt, setPrompt] = useState('');
  const [session, setSession] = useState<AgentSession | null>(null);
  const [log, setLog] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [command, setCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [logCopied, setLogCopied] = useState(false);
  const [pollWarning, setPollWarning] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const pollFailureCountRef = useRef(0);

  // Recover this agent's most recent session on open - without this, reopening the panel (or a
  // page reload) after a session was started elsewhere shows a blank form with no way to see or
  // free a session stuck as Running.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const existing = await fetchSessions(agentId, controller.signal);
        const latest = existing[0];
        if (!latest) return;
        sessionIdRef.current = latest.id;
        setSession(latest);
        const logResult = await fetchSessionLog(latest.id, controller.signal);
        setLog(logResult.log);
      } catch {
        // Best effort - the panel still works for starting a fresh session either way.
      }
    })();
    return () => controller.abort();
  }, [agentId]);

  useEffect(() => {
    if (!session || session.status !== 'Running') {
      return;
    }

    const controller = new AbortController();
    const interval = setInterval(async () => {
      try {
        const [latest, logResult] = await Promise.all([
          fetchSession(session.id, controller.signal),
          fetchSessionLog(session.id, controller.signal),
        ]);
        if (sessionIdRef.current === session.id) {
          setSession(latest);
          setLog(logResult.log);
          pollFailureCountRef.current = 0;
          setPollWarning(null);
        }
      } catch (err) {
        // Transient poll failure - keep retrying, but let the user know if it's not clearing up.
        if (controller.signal.aborted) return;
        pollFailureCountRef.current += 1;
        if (pollFailureCountRef.current >= 3) {
          setPollWarning(
            `Live status/log updates aren't coming through (${err instanceof Error ? err.message : 'unknown error'}). Still retrying...`,
          );
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [session]);

  async function handleCopyCommand() {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const result = await preparePrompt(agentId, prompt);
      setCommand(result.command);
      await navigator.clipboard.writeText(result.command).catch(() => undefined);
      setCopied(true);
    } catch (err) {
      setCommand(null);
      setError(err instanceof Error ? err.message : 'Failed to prepare command');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLog() {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(log);
      setLogCopied(true);
      setTimeout(() => setLogCopied(false), 2000);
    } catch {
      // Clipboard permission denied or unavailable - no harm in silently no-oping.
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConfirmOpen(true);
  }

  async function handleConfirmStart() {
    setConfirmOpen(false);
    setBusy(true);
    setError(null);
    setPollWarning(null);
    pollFailureCountRef.current = 0;
    try {
      const started = await startSession(agentId, prompt);
      sessionIdRef.current = started.id;
      setSession(started);
      setLog('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!session) return;
    setError(null);
    try {
      const updated = await forceStopSession(session.id);
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop session');
    }
  }

  const running = session?.status === 'Running';

  return (
    <div className="session-panel">
      <form className="work-form" onSubmit={handleSubmit}>
        <textarea
          placeholder="What should this agent do?"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setCopied(false);
          }}
          required
          disabled={running}
        />
        <div className="work-actions">
          <button type="button" className="btn-secondary" onClick={handleCopyCommand} disabled={busy || !prompt.trim()}>
            {copied ? 'Copied to clipboard' : 'Copy command'}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || running || !prompt.trim()}>
            Run now
          </button>
        </div>
        {command && (
          <div className="prompt-command">
            <code>{command}</code>
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
      </form>

      {confirmOpen && (
        <ConfirmDialog
          title="Run this agent for real?"
          message={`This will actually run "claude" against ${repoName ?? 'this repo'} with the prompt above and may change files.`}
          confirmLabel="Run now"
          onConfirm={handleConfirmStart}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {session && (
        <div className="session-status">
          <div className="session-status-row">
            <span className={`pill ${running ? 'working' : session.status === 'Failed' ? 'warn' : 'idle'}`}>
              <span className="dot" />
              {statusLabel(session.status)}
            </span>
            {running && (
              <button type="button" className="btn-danger" onClick={handleStop} title="Stops the process if tracked, and always frees the agent either way">
                Stop
              </button>
            )}
            {session.exitCode !== null && <span className="session-exit-code">exit {session.exitCode}</span>}
          </div>
          {pollWarning && <div className="error-banner">{pollWarning}</div>}
          <div className="session-log-frame">
            <div className="session-log-titlebar">
              <span>Log output</span>
              <button type="button" className="log-copy-btn" onClick={handleCopyLog} disabled={!log}>
                {logCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="session-log">{log || '(no output yet)'}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
