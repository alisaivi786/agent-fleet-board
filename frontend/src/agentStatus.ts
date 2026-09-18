import type { AgentStatus } from './types';

export function isIdle(agent: AgentStatus): boolean {
  return !agent.error && agent.isClean && agent.aheadOfBase === 0;
}

export function isWorking(agent: AgentStatus): boolean {
  return !agent.error && (!agent.isClean || agent.aheadOfBase > 0);
}
