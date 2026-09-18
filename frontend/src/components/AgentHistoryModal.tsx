import { useEffect, useRef, useState } from 'react';
import type { AgentSession } from '../types';
import { fetchSession, fetchSessionLog, fetchSessions, forceStopSession } from '../api';

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

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function HistoryEntry({ session, onChange }: { session: AgentSession; onChange: (updated: AgentSession) => void }) {
  const [expanded, setExpanded] = useState(session.status === 'Running');
  const [log, setLog] = useState('');
  const [logError, setLogError] = useState<string | null>(null);
  const [stopBusy, setStopBusy] = useState(false);
  const running = session.status === 'Running';

  // Load the log once expanded, and keep polling both log and status while it's actually
  // running - this is the "view running session live, until stopped" part of the request.
  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    let interval: ReturnType<typeof setInterval> | undefined;

    async function tick() {
      try {
        const logResult = await fetchSessionLog(session.id, controller.signal);
        setLog(logResult.log);
        setLogError(null);
        if (running) {
          const latest = await fetchSession(session.id, controller.signal);
          onChange(latest);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setLogError(err instanceof Error ? err.message : 'Failed to load log');
      }
    }

    tick();
    if (running) {
      interval = setInterval(tick, POLL_INTERVAL_MS);
    }
    return () => {
      controller.abort();
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, running, session.id]);

  async function handleStop() {
    setStopBusy(true);
    try {
      const updated = await forceStopSession(session.id);
      onChange(updated);
    } finally {
      setStopBusy(false);
    }
  }

  return (
    <div className="history-entry">
      <button type="button" className="history-entry-head" onClick={() => setExpanded((v) => !v)}>
        <span className={`pill ${running ? 'working' : session.status === 'Failed' ? 'warn' : 'idle'}`}>
          <span className="dot" />
          {statusLabel(session.status)}
        </span>
        <span className="history-entry-prompt">{session.prompt}</span>
        <span className="history-entry-time">{absoluteTime(session.startedAtUtc)}</span>
      </button>
      {expanded && (
        <div className="history-entry-body">
          <div className="history-entry-meta">
            <span>
              Request: <strong>{session.prompt}</strong>
            </span>
            {session.exitCode !== null && <span className="session-exit-code">exit {session.exitCode}</span>}
            {running && (
              <button type="button" className="btn-danger" onClick={handleStop} disabled={stopBusy}>
                Stop
              </button>
            )}
          </div>
          <div className="session-log-frame">
            <div className="session-log-titlebar">
              <span>Response / log output</span>
            </div>
            <pre className="session-log">{log || '(no output yet)'}</pre>
          </div>
          {logError && <div className="error-banner">{logError}</div>}
        </div>
      )}
    </div>
  );
}

export function AgentHistoryModal({
  agentId,
  agentName,
  onClose,
}: {
  agentId: string;
  agentName: string;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<AgentSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load(signal?: AbortSignal) {
    try {
      const result = await fetchSessions(agentId, signal);
      setSessions(result);
      setError(null);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Failed to load session history');
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    // Re-list every few seconds so a brand new session started elsewhere shows up here too,
    // not just updates to sessions already in the list (each entry polls its own log/status).
    pollRef.current = setInterval(() => load(), POLL_INTERVAL_MS * 2);
    return () => {
      controller.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  function handleEntryChange(updated: AgentSession) {
    setSessions((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? prev);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{agentName} - session history</div>
        {error && <div className="error-banner">{error}</div>}
        {!sessions ? (
          <p className="loading">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="loading">No sessions have been run for this agent yet.</p>
        ) : (
          <div className="history-list">
            {sessions.map((session) => (
              <HistoryEntry key={session.id} session={session} onChange={handleEntryChange} />
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
