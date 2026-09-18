# Phase 2 build plan — from static config to a repo/agent registry

This is the concrete, do-this-next plan for replacing the static `appsettings.Local.json` agent
list with a real registry you manage from the UI — Phase 2a from `docs/ROADMAP.md`, broken into
buildable steps with explicit backend + frontend work per phase. A fresh session can start at
Step 1 and work straight through; each phase has its own "definition of done" so progress is
checkable without re-reading everything.

**Read first:** `CLAUDE.md` (security rules, how this repo is set up) and `docs/ROADMAP.md` (why
these phases exist, what's still undecided beyond this plan — Phase 2d/"real dispatch" is
deliberately out of scope here, see that doc's security-boundary question before ever starting it).

**Ground rule carried over from `CLAUDE.md`:** a repo `Path` is registry data, never a raw path
accepted from an arbitrary client call without going through the registry first. Phase 1 below is
what makes that safe — the registry *is* the allowlist.

---

## Phase 1 — Repo registry (backend)

Replace the hardcoded `AgentFleet:Agents` config section with a persisted, API-managed registry of
repos. Agents don't exist yet in this phase — just repos.

**Backend:**
- `backend/Models/RepoDefinition.cs` — `record RepoDefinition(Guid Id, string Name, string Path, string BaseBranch)`.
- `backend/Services/IRepoRegistry.cs` / `RepoRegistry.cs` — reads/writes a JSON file
  (`backend/data/registry.json`, gitignored — same reasoning as `appsettings.Local.json`: never
  commit real local paths). Methods: `GetAllAsync`, `AddAsync(name, path, baseBranch)`,
  `RemoveAsync(id)`. Validate `Path` exists and is a directory before accepting it (reuse the
  `Directory.Exists` check style already in `GitStatusReader`). Guard concurrent writes with a
  simple lock — this is a single-process local tool, no need for anything fancier.
- Register as singleton in `Program.cs`, same pattern as `IGitStatusReader`.
- New endpoints:
  - `GET /api/repos` → list.
  - `POST /api/repos` → body `{ name, path, baseBranch }`, returns the created `RepoDefinition`
    (400 if path doesn't exist/isn't a directory — validate server-side, don't trust the client).
  - `DELETE /api/repos/{id}`.

**Definition of done:** `dotnet build -warnaserror` clean; you can `curl -X POST` a repo in,
`GET /api/repos` shows it, restart the process and it's still there (proves it's actually
persisted, not in-memory).

---

## Phase 2 — Agent registry + assignment (backend)

Agents become real entities with an identity separate from "which repo they're currently pointed
at" — matching the already-locked-in decision that assignment is per-task, not fixed.

**Backend:**
- `backend/Models/AgentDefinition.cs` — `record AgentDefinition(Guid Id, string Name, string Role, Guid? AssignedRepoId)`.
- Extend the registry (or add `IAgentRegistry`/`AgentRegistry` alongside it, same JSON-file
  pattern) with `GetAllAsync`, `CreateAsync(name, role)`, `AssignAsync(agentId, repoId)`,
  `UnassignAsync(agentId)`, `RemoveAsync(agentId)`. `AssignAsync` must reject an unknown `repoId`
  (look it up in the repo registry — this is the allowlist check from the ground rule above).
- Endpoints:
  - `GET /api/agents` — **replaces** the current implementation. For each `AgentDefinition`,
    resolve its assigned repo's `Path`/`BaseBranch` (or `null` fields if unassigned) and run the
    existing `IGitStatusReader` against it exactly like today — the response shape agents already
    expects (`AgentStatus`) barely changes, it's just sourced from the registry instead of
    `appsettings`. Add `id` and `repoId`/`repoName` fields to `AgentStatus` so the frontend can
    manage assignment.
  - `POST /api/agents` → `{ name, role }`.
  - `POST /api/agents/{id}/assign` → `{ repoId }`.
  - `POST /api/agents/{id}/unassign`.
  - `DELETE /api/agents/{id}`.
- One-time migration: move your real Alice/Bob/Dua entries out of
  `backend/appsettings.Local.json` and register them through these new endpoints instead (a short
  script or a few `curl` calls is fine — this doesn't need a formal migration tool for 3 rows).
  Once done, `AgentFleetOptions`/`appsettings.Local.json.example` can be deleted along with the
  config-binding code in `Program.cs`.

**Definition of done:** the same manual curl flow as Phase 1, plus: creating an agent, assigning it
to a repo, then `GET /api/agents` shows live git status for that repo under that agent's name —
i.e. the exact behavior v1 already had, now driven by data instead of config.

---

## Phase 3 — Registry management UI (frontend)

**Frontend:**
- `src/api.ts` — add `fetchRepos`, `createRepo`, `deleteRepo`, `createAgent`, `assignAgent`,
  `unassignAgent`, `deleteAgent`, matching the new endpoints.
- `src/types.ts` — add `RepoDefinition`; extend `AgentStatus` with `id`/`repoId`/`repoName`.
- New `src/components/RepoManager.tsx` — a simple table of registered repos (name, path, base
  branch, delete button) plus an "Add repo" form (name, path, base branch inputs → `createRepo`,
  refetch on success). Follow the existing card/table visual language in `index.css` (`.card`,
  `.kv`, `.stat` tokens) rather than inventing new styles.
- New `src/components/AgentManager.tsx` — same pattern for agents: table with a repo-assignment
  `<select>` per row (options = registered repos, calls `assignAgent`/`unassignAgent` on change),
  plus a "Create agent" form (name, role).
- `App.tsx` — add simple tab/section switching between "Roster" (existing live-status view, now
  reading `repoName` from the registry-backed response) and "Manage" (the two new components). Do
  not introduce a router dependency for two tabs — local `useState` is enough.

**Definition of done:** you can add a repo, create an agent, assign it, and watch it show up with
live status in the Roster tab — the whole loop, from empty registry to a working dashboard entry,
done entirely through the UI with zero manual JSON editing.

---

## Phase 4 — Manual-launch bridge (Phase 2b from the roadmap)

Still no real process spawning — this phase is about validating the "hand an agent a prompt" UX
before touching the security question in `docs/ROADMAP.md`'s open question #5.

**Backend:**
- `POST /api/agents/{id}/prepare-prompt` → `{ prompt }`, returns `{ command }` where `command` is
  a ready-to-run CLI invocation string (e.g. `claude` pointed at the agent's assigned repo `Path`
  with the given prompt) — **constructed server-side from the registry-resolved path, never from a
  client-supplied path.** This endpoint does not execute anything; it only formats a string.

**Frontend:**
- `AgentCard.tsx` gets a "Prompt" action → textarea → "Prepare command" → shows the returned
  command in a copyable code block (reuse `.worktree-path`'s monospace-block styling). The
  operator copies it into their own terminal and runs it themselves.

**Definition of done:** an operator can go from "type a prompt for Dua" to "have a correct,
copy-pasteable command for Dua's assigned repo" entirely through the UI.

---

## Explicitly not in this plan

Real dispatch (the backend actually spawning/supervising a Claude Code session, streaming its
output live) is `docs/ROADMAP.md`'s Phase 2c/"open question #1" — it needs its own design
decision (subprocess vs. Agent SDK vs. stay a viewer) confirmed with the user before any code, not
because it's harder to build than the phases above, but because it's the phase where this tool's
security model actually changes shape. Don't fold it into "finishing the job" from this plan
without that conversation happening first.
