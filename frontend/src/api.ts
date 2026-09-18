import type { AgentStatus } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5299';

export async function fetchAgents(signal?: AbortSignal): Promise<AgentStatus[]> {
  const response = await fetch(`${API_BASE}/api/agents`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load agents (${response.status})`);
  }
  return response.json();
}
