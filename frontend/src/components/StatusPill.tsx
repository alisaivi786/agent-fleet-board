import type { AgentStatus } from '../types';
import { isWorking } from '../agentStatus';

export function StatusPill({ agent, running = false }: { agent: AgentStatus; running?: boolean }) {
  if (agent.error) {
    return (
      <span className="pill warn">
        <span className="dot" />
        Unreachable
      </span>
    );
  }
  // A real running session always wins over the git-derived Diverged/Idle read - an agent can be
  // git-clean while a session is genuinely running (that's exactly the case this was missing).
  if (running) {
    return (
      <span className="pill working" title="A claude session is actually running for this agent right now.">
        <span className="dot" />
        Running
      </span>
    );
  }
  if (isWorking(agent)) {
    return (
      <span className="pill working" title="Ahead of base or has uncommitted changes - reflects git status, not a live running process.">
        <span className="dot" />
        Diverged
      </span>
    );
  }
  return (
    <span className="pill idle">
      <span className="dot" />
      Idle
    </span>
  );
}
