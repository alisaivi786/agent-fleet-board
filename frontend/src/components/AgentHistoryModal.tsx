import { useEffect, useState } from 'react';
import type { AgentSession } from '../types';
import { fetchSession, fetchSessionLog, fetchSessions, forceStopSession } from '../api';
import { avatarColor } from '../colors';
import { CloseIcon } from '../icons';

const POLL_INTERVAL_MS = 2000;

function statusLabel(status: AgentSession['status']): string {
  switch (status) {
    case 'Running':
      return 'Running';
    case 'Succeeded':
      return 'Succeeded';
    case 'Failed':
      return 'Failed';
    case 'Stopped':
      return 'Stopped';
  }
}

function statusClass(status: AgentSession['status']): string {
  if (status === 'Running') return 'working';
  if (status === 'Failed') return 'warn';
  return 'idle';
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function duration(session: AgentSession): string | null {
  if (!session.endedAtUtc) return null;
  const ms = new Date(session.endedAtUtc).getTime() - new Date(session.startedAtUtc).getTime();
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function Turn({ session, onChange }: { session: AgentSession; onChange: (updated: AgentSession) => void }) {
  const [log, setLog] = useState('');
  const [logError, setLogError] = useState<string | null>(null);
  const [stopBusy, setStopBusy] = useState(false);
  const running = session.status === 'Running';

  useEffect(() => {
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
  }, [running, session.id]);

  async function handleStop() {
    setStopBusy(true);
    try {
      const updated = await forceStopSession(session.id);
      onChange(updated);
    } finally {
      setStopBusy(false);
    }
  }

  const durationLabel = duration(session);

  return (
    <div className="chat-turn">
      <div className="chat-turn-time">
        {absoluteTime(session.startedAtUtc)}
        {durationLabel && <span className="chat-turn-duration"> · {durationLabel}</span>}
      </div>

      <div className="chat-bubble chat-bubble-user">
        <div className="chat-bubble-label">Request</div>
        <div className="chat-bubble-text">{session.prompt}</div>
      </div>

      <div className="chat-bubble chat-bubble-agent">
        <div className="chat-bubble-agent-head">
          <span className={`pill ${statusClass(session.status)}`}>
            <span className="dot" />
            {statusLabel(session.status)}
          </span>
          {session.exitCode !== null && <span className="chat-exit-code">exit {session.exitCode}</span>}
          {running && (
            <button type="button" className="btn-danger chat-stop-btn" onClick={handleStop} disabled={stopBusy}>
              Stop
            </button>
          )}
        </div>
        <pre className="chat-bubble-log">{log || (running ? 'Waiting for output…' : '(no output captured)')}</pre>
        {logError && <div className="error-banner">{logError}</div>}
      </div>
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
    // Re-list periodically so a session started elsewhere while this is open still shows up -
    // each turn below polls its own log/status independently once it exists in the list.
    const interval = setInterval(() => load(), POLL_INTERVAL_MS * 2);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  function handleTurnChange(updated: AgentSession) {
    setSessions((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? prev);
  }

  const runningCount = sessions?.filter((s) => s.status === 'Running').length ?? 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="history-modal-head">
          <div className="history-modal-heading">
            <span className="avatar avatar-sm" style={{ background: avatarColor(agentName) }}>
              {agentName.charAt(0).toUpperCase()}
            </span>
            <div>
              <div className="modal-title history-modal-title">{agentName}</div>
              <div className="history-modal-subtitle">
                Session history
                {runningCount > 0 && ` · ${runningCount} running now`}
              </div>
            </div>
          </div>
          <button type="button" className="icon-btn history-close-btn" onClick={onClose} title="Close">
            <CloseIcon />
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {!sessions ? (
          <p className="loading">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="loading">No sessions have been run for this agent yet.</p>
        ) : (
          <div className="chat-transcript">
            {sessions.map((session) => (
              <Turn key={session.id} session={session} onChange={handleTurnChange} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
