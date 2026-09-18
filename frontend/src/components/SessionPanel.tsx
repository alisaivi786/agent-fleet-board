import { useEffect, useRef, useState } from 'react';
import { fetchSession, fetchSessionLog, startSession, stopSession } from '../api';
import type { AgentSession } from '../types';

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
  const [pollWarning, setPollWarning] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pollFailureCountRef = useRef(0);

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

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        `This will actually run "claude" against ${repoName ?? 'this repo'} with the prompt below and may change files. Continue?`,
      )
    ) {
      return;
    }

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
    try {
      await stopSession(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop session');
    }
  }

  return (
    <div className="session-panel">
      <form className="prompt-box" onSubmit={handleStart}>
        <textarea
          placeholder="What should this agent actually do? (runs for real)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          disabled={session?.status === 'Running'}
        />
        <button type="submit" disabled={busy || session?.status === 'Running'}>
          Run now
        </button>
        {error && <div className="error-banner">{error}</div>}
      </form>

      {session && (
        <div className="session-status">
          <div className="session-status-row">
            <span className={`pill ${session.status === 'Running' ? 'working' : session.status === 'Failed' ? 'warn' : 'idle'}`}>
              <span className="dot" />
              {statusLabel(session.status)}
            </span>
            {session.status === 'Running' && (
              <button type="button" className="btn-danger" onClick={handleStop}>
                Stop
              </button>
            )}
            {session.exitCode !== null && <span className="session-exit-code">exit {session.exitCode}</span>}
          </div>
          {pollWarning && <div className="error-banner">{pollWarning}</div>}
          <div className="session-log-frame">
            <div className="session-log-titlebar">Log output</div>
            <pre className="session-log">{log || '(no output yet)'}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
