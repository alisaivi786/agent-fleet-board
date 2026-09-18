import type { AgentStatus } from '../types';
import { isWorking } from '../agentStatus';

export function StatusPill({ agent }: { agent: AgentStatus }) {
  if (agent.error) {
    return (
      <span className="pill warn">
        <span className="dot" />
        Unreachable
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
