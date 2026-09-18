# Agent Fleet Board — project context

This file exists so any Claude session (not just the one that built this) can pick up this project
cold and know what's built, why, and what's next. Read this before making changes.

## What this is

A dashboard for watching a fleet of local coding-agent working trees (git worktrees, typically one
per "agent persona" like Alice/Bob/Dua) — branch, last commit, ahead/behind a base branch,
uncommitted files — refreshed live. Built originally against `D:\Code\FMS-Prime`'s agent worktrees,
but it is **not specific to that repo** — any agent name maps to any local git path you configure.

**Current status: v1 is done and working.** It is a *read-only status viewer*. It does not launch
agents, does not send them prompts, and does not know anything about Claude Code sessions. That is
the deliberate scope boundary for v1 — see "Phase 2" below for what's next and still undecided.

## Architecture

```
agent-fleet-board/
  backend/    .NET 10 minimal API — GET /api/agents
  frontend/   React + Vite + TypeScript — polls the API every 5s
  Makefile    make backend | make frontend | make dev | make install | make build | make configure
```

**Backend** (`backend/Program.cs`, `backend/Services/GitStatusReader.cs`):
- Reads agent definitions (`Name`, `Role`, `RepoPath`, `BaseBranch`) from config section
  `AgentFleet:Agents`, bound via `Options/AgentFleetOptions.cs`.
- `appsettings.json` ships with an **empty** agent list (safe for a public repo).
- Real paths live in `backend/appsettings.Local.json`, which is **gitignored** — never commit real
  filesystem paths. `backend/appsettings.Local.json.example` shows the shape; `make configure`
  copies it for you if the real file doesn't exist yet.
- `GitStatusReader` shells out to the system `git` binary via `ProcessStartInfo` with
  `ArgumentList` (never a shell string) against **server-configured paths only**. This is a hard
  rule, not a style preference: **never** wire a client-supplied path into this reader — it would
  become an arbitrary path-read/command primitive. See the security note below.

**Frontend** (`frontend/src/`):
- `App.tsx` polls `GET /api/agents` every 5s (`POLL_INTERVAL_MS`), no other state management.
- `types.ts` mirrors the backend's `AgentStatus` record exactly (camelCase, matches
  System.Text.Json's default).
- `components/AgentCard.tsx` renders one agent; `colors.ts` deterministically hashes agent name to
  an avatar color so new agent names (not just Alice/Bob/Dua) get a sane look with zero config.
- Design tokens (light/dark theme, IBM Plex Sans/Mono) live in `index.css`. This was carried over
  intentionally from an earlier static-snapshot prototype (a Claude Artifact) that was validated
  with the user before the live version was built — keep the visual language if you extend it.

## Security (read before touching the backend)

- **No authentication.** Anyone who can reach the API can read local git state (branch names,
  commit messages, file paths) for every configured agent.
- **Only ever run this bound to localhost.** Do not change the default bind address to `0.0.0.0`
  or deploy it publicly reachable without adding real auth first.
- The `RepoPath` for every agent is server-config only, never accepted from a request body/query.
  If a future feature needs to accept a path or repo identifier from the client (e.g. Phase 2's
  "point an agent at a repo from the UI"), it must be validated against an allowlist of
  already-registered paths — never passed raw into a `git`/filesystem call.

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
make configure   # first time only: creates backend/appsettings.Local.json from the example
# edit backend/appsettings.Local.json to point at real agent repo paths
make backend     # http://localhost:5299
make frontend    # http://localhost:5173 (separate terminal/session)
```

## Phase 2 — not built yet, deliberately parked

**Full plan: [`docs/ROADMAP.md`](docs/ROADMAP.md).** Read it before touching anything beyond v1 —
it has the target user stories, the architecture options for actually launching agent sessions,
every open question that needs the user's input before code gets written, and a rough phasing.

Short version: the end goal is a UI where you can **create an agent, point it at any repo, and
hand it a prompt**, with a backend service that drives a real Claude Code session against that
repo — this dashboard's read-only view becomes one panel in a larger control plane, not the whole
product. One decision already locked in: **agent-to-repo binding is assignable per task, not
fixed** (no "Alice always does frontend").

Do not start implementing Phase 2 without asking the user to confirm scope — `docs/ROADMAP.md` is
context to resume the conversation from, not a spec to build from silently.
