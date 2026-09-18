# Agent Fleet Board — project context

This file exists so any Claude session (not just the one that built this) can pick up this project
cold and know what's built, why, and what's next. Read this before making changes.

## What this is

A dashboard for watching a fleet of local coding-agent working trees (git worktrees, typically one
per "agent persona" like Alice/Bob/Dua) — branch, last commit, ahead/behind a base branch,
uncommitted files — refreshed live. Built originally against `D:\Code\FMS-Prime`'s agent worktrees,
but it is **not specific to that repo** — any agent name maps to any local git path you configure.

**Current status: v1 is done. Phase 1+2 of Phase 2 (repo/agent registry) is done on the backend.**
Repos and agents are now persisted, API-managed entities (no more hand-edited config file), but
there is still no launching, no prompts, and no Claude Code session awareness — the frontend also
hasn't been updated for the registry yet (still Phase 3, not built). See "Phase 2" below for what's
still undecided.

## Architecture

```
agent-fleet-board/
  backend/    .NET 10 minimal API — /api/repos, /api/agents (registry-backed)
  frontend/   React + Vite + TypeScript — polls GET /api/agents every 5s
  Makefile    make backend | make frontend | make dev | make install | make build
```

**Backend** (`backend/Program.cs`, `backend/Services/`):
- `IRepoRegistry`/`RepoRegistry` and `IAgentRegistry`/`AgentRegistry` persist to
  `backend/data/repos.json` / `agents.json` (JSON array files, one lock per store via the shared
  `JsonFileStore<T>` helper). Both files are **gitignored** — same reasoning as the old
  `appsettings.Local.json`: never commit real local paths.
- `POST /api/repos` validates the path exists/is a directory server-side before persisting.
  `AgentRegistry.AssignAsync` validates the `repoId` against `IRepoRegistry` before persisting an
  assignment — **the repo registry is the allowlist**, an agent can never be pointed at an
  unregistered path.
- `GET /api/agents` resolves each `AgentDefinition`'s assigned `RepoDefinition` (if any) and runs
  `IGitStatusReader` against its `Path`/`BaseBranch`; an unassigned agent gets a status with
  `Error: "No repo assigned."` and no git fields populated.
- `GitStatusReader` shells out to the system `git` binary via `ProcessStartInfo` with
  `ArgumentList` (never a shell string) against a **registry-resolved path only** (a `repoPath`
  parameter, sourced from `IRepoRegistry`, never a client-supplied path). This is a hard rule, not
  a style preference: **never** wire a client-supplied path into this reader — it would become an
  arbitrary path-read/command primitive. See the security note below.
- The old `Options/AgentFleetOptions.cs` config-binding path and
  `appsettings.Local.json.example` are gone. `backend/appsettings.Local.json` (the real, gitignored
  file with the actual Alice/Bob/Dua paths) is no longer read by the app but was left on disk rather
  than deleted; the same three agents were migrated into `backend/data/repos.json`/`agents.json`
  with fresh GUIDs so `GET /api/agents` keeps working with zero manual steps.

## Security (read before touching the backend)

- **No authentication.** Anyone who can reach the API can read local git state (branch names,
  commit messages, file paths) for every configured agent.
- **Only ever run this bound to localhost.** Do not change the default bind address to `0.0.0.0`
  or deploy it publicly reachable without adding real auth first.
- The path `GitStatusReader` actually runs against always comes from `IRepoRegistry`, never
  straight from a request body/query. A client can pick a repo *by id* (`POST
  /api/agents/{id}/assign`), but the `repoId` is checked against the registry before it's accepted
  — a raw path is never passed through. `POST /api/repos` is the only place a raw path is ever
  accepted from a client, and it's validated (`Directory.Exists`) before being persisted as a new
  allowlist entry.

## Repo / deploy facts

- **Public GitHub repo**, personal account: `github.com/alisaivi786/agent-fleet-board`. This is
  intentionally separate from the FMS-Prime Azure DevOps org — do not mix credentials or workflows
  between them.
- Push access is via a **dedicated deploy key**, not the machine's main work SSH key. The work key
  (`~/.ssh/id_ed25519`) is passphrase-protected and tied to the `absoluit\ali.mushtaq` identity —
  it was deliberately *not* reused here. A separate, passphrase-free key
  (`~/.ssh/id_ed25519_agent_fleet_board`) was generated specifically for this repo and registered
  as a **deploy key with write access** on the repo itself (Settings → Deploy keys), not as an
  account-wide SSH key.
- This network blocks outbound SSH on port 22, so `~/.ssh/config` routes `github.com` through
  `ssh.github.com:443` (SSH-over-HTTPS). If push ever fails with a connection timeout (not an auth
  error), check that config is still intact before assuming credentials are the problem.
- Local git identity for this repo is set locally (`git config user.email
  alisaivi786@gmail.com` inside this repo only) — not the global/work identity.

## How to run it

```bash
make backend     # http://localhost:5299
make frontend    # http://localhost:5173 (separate terminal/session)
```

On this machine `backend/data/repos.json`/`agents.json` already exist with Alice/Bob/Dua migrated
in (gitignored, so a fresh clone starts with an empty registry) — see README.md for the `POST
/api/repos` / `POST /api/agents` / `.../assign` curl calls to populate it from scratch. There's no
UI for this yet (Phase 3, not built).

## Phase 2 — not built yet, deliberately parked

**Vision + open questions: [`docs/ROADMAP.md`](docs/ROADMAP.md). Concrete step-by-step build plan
for the next two phases: [`docs/PHASE-2-BUILD-PLAN.md`](docs/PHASE-2-BUILD-PLAN.md).** Read the
roadmap for *why* and the build plan for *what to actually do next* — it has exact files,
endpoints, and a definition-of-done per phase, ready for a fresh session to execute top to bottom.

Short version: the end goal is a UI where you can **create an agent, point it at any repo, and
hand it a prompt**, with a backend service that drives a real Claude Code session against that
repo — this dashboard's read-only view becomes one panel in a larger control plane, not the whole
product. One decision already locked in: **agent-to-repo binding is assignable per task, not
fixed** (no "Alice always does frontend").

`docs/PHASE-2-BUILD-PLAN.md`'s Phase 1 (repo registry) and Phase 2 (agent registry + assignment)
are **done** — see the Architecture section above. The next concrete step is that build plan's
Phase 3 (registry management UI on the frontend); Phase 4 (manual-launch/prepare-prompt bridge)
and real dispatch (Phase 2c in `docs/ROADMAP.md`) are still not started.

Do not start implementing further phases without asking the user to confirm scope —
`docs/ROADMAP.md` is context to resume the conversation from, not a spec to build from silently.
