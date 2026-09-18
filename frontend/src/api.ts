import type { AgentDefinition, AgentStatus, RepoDefinition } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5299';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export function fetchAgents(signal?: AbortSignal): Promise<AgentStatus[]> {
  return request('/api/agents', { signal });
}

export function fetchRepos(signal?: AbortSignal): Promise<RepoDefinition[]> {
  return request('/api/repos', { signal });
}

export function createRepo(input: { name: string; path: string; baseBranch: string }): Promise<RepoDefinition> {
  return request('/api/repos', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteRepo(id: string): Promise<void> {
  return request(`/api/repos/${id}`, { method: 'DELETE' });
}

export function createAgent(input: { name: string; role: string }): Promise<AgentDefinition> {
  return request('/api/agents', { method: 'POST', body: JSON.stringify(input) });
}

export function assignAgent(id: string, repoId: string): Promise<AgentDefinition> {
  return request(`/api/agents/${id}/assign`, { method: 'POST', body: JSON.stringify({ repoId }) });
}

export function unassignAgent(id: string): Promise<AgentDefinition> {
  return request(`/api/agents/${id}/unassign`, { method: 'POST' });
}

export function deleteAgent(id: string): Promise<void> {
  return request(`/api/agents/${id}`, { method: 'DELETE' });
}
