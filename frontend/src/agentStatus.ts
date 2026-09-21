import type { AgentStatus } from './types';

export function isWorking(agent: AgentStatus): boolean {
  return !agent.error && (!agent.isClean || agent.aheadOfBase > 0) && !agent.divergenceAcknowledged;
}

// The complement of isWorking (for a reachable agent) - kept as a real predicate, not just "not
// working", so an acknowledged-diverged agent (isClean, ahead of base, but reviewed and accepted)
// correctly counts as idle rather than falling into neither bucket.
export function isIdle(agent: AgentStatus): boolean {
  return !agent.error && !isWorking(agent);
}
