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
      <span className="pill working">
        <span className="dot" />
        Working
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
