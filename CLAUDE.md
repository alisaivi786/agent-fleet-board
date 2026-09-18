# Agent Fleet Board — project context

This file exists so any Claude session (not just the one that built this) can pick up this project
cold and know what's built, why, and what's next. Read this before making changes.

## What this is

A dashboard for watching a fleet of local coding-agent working trees (git worktrees, typically one
per "agent persona" like Alice/Bob/Dua) — branch, last commit, ahead/behind a base branch,
uncommitted files — refreshed live. Built originally against `D:\Code\FMS-Prime`'s agent worktrees,
but it is **not specific to that repo** — any agent name maps to any local git path you configure.

**Current status: v1 is done. Phase 1-3 of Phase 2 (repo/agent registry + management UI) are
done.** Repos and agents are persisted API-managed entities in Postgres, with a Manage tab in the
UI to create/assign them - no more hand-edited config file, no more JSON-file registry either. All
endpoints are anonymous for now (no auth, no permissions) by explicit decision - that's a later,
separate pass, not an oversight. There is still no launching, no prompts, and no Claude Code
session awareness. See "Phase 2" below for what's still undecided.

## Architecture

```
agent-fleet-board/
  docker-compose.yml   postgres only (the API/migrations run on the host, not in Docker)
  backend/
    AgentFleetBoard.slnx
    src/
      AgentFleetBoard.Domain        RepoDefinition, AgentDefinition (plain EF entities)
      AgentFleetBoard.Persistence   DbContext, IRepoRegistry/IAgentRegistry (EF Core + Npgsql)
      AgentFleetBoard.Migrations    FluentMigrator console app, run separately from the API
      AgentFleetBoard.Api           minimal API + Swagger, references Domain + Persistence
  frontend/   React + Vite + TypeScript — polls GET /api/agents every 5s, Manage tab for CRUD
  Makefile    make db | migrate | backend | frontend | dev | install | build
```

This mirrors `D:\Code\FMS-Prime\src`'s layered style (Domain/Persistence/Migrations/Api as
separate projects) scaled down to what this tool actually needs - no Application/CQRS layer, no
Common/Infrastructure/External libs, because there's no cross-cutting complexity here yet that
would justify them. Add layers when something concrete needs them, not preemptively.

**Persistence** (`backend/src/AgentFleetBoard.Persistence/`):
- `AgentFleetBoardDbContext` maps `RepoDefinition` -> `repos` and `AgentDefinition` -> `agents`,
  snake_case via `EFCore.NamingConventions` (`UseSnakeCaseNamingConvention()`). Connection string
  comes from `ConnectionStrings:Postgres` (see `PersistenceServiceCollectionExtensions.AddPersistence`).
- `RepoRegistry`/`AgentRegistry` are thin EF Core wrappers (no repository-pattern ceremony beyond
  what `IRepoRegistry`/`IAgentRegistry` already needed). `AgentRegistry.AssignAsync` checks the
  `repoId` exists before persisting — **the repos table is the allowlist**, an agent can never end
  up pointed at an unregistered path. The FK `agents.assigned_repo_id -> repos.id` is `ON DELETE
  SET NULL`, so deleting a repo cleanly unassigns any agent pointing at it at the DB level too.
- **Gotcha already hit once:** don't run per-row `DbContext` calls inside `Task.WhenAll` /
  `.Select(async ...)` — a `DbContext` isn't thread-safe and throws "a second operation was started
  on this context instance." `GET /api/agents` in `Program.cs` fetches all repos once into a
  dictionary *before* the parallel `Task.WhenAll` over `IGitStatusReader.ReadAsync` (which shells
  out to git, no DbContext, safe to parallelize).

**Migrations** (`backend/src/AgentFleetBoard.Migrations/`):
- Plain FluentMigrator bootstrap (`AddFluentMigratorCore().ConfigureRunner(rb => rb.AddPostgres()...)`)
  reading its connection string from the `AGENTFLEETBOARD_MIGRATION_CONNECTION` env var — not
  FMS-Prime's private `Ninja.Kit.FluentMigration`/`MigrationRunnerHost` helper, which isn't
  publicly available. `make migrate` wires that env var from `.env`.
- Only one migration exists so far: `001_CreateRegistryTables.cs` (creates `repos` and `agents`,
  Postgres-only via `Execute.Sql`, no SQL Server branch — FMS-Prime supports both databases, this
  tool only ever targets Postgres).
- **Real local dev data (Alice/Bob/Dua's actual `D:\Code\FMS-Prime\...` worktree paths) is
  intentionally NOT in a committed migration** — that would leak real filesystem paths into a
  public repo (same rule as the old `appsettings.Local.json`). It was inserted directly into this
  machine's Postgres via `docker exec ... psql` after migrating; a fresh clone's DB starts empty
  and needs repos/agents registered through the API (see README.md).

**Api** (`backend/src/AgentFleetBoard.Api/Program.cs`):
- `GitStatusReader` (unchanged from before this restructuring) shells out to the system `git`
  binary via `ProcessStartInfo` with `ArgumentList` (never a shell string) against a
  **registry-resolved path only**. This is a hard rule, not a style preference: **never** wire a
  client-supplied path into this reader — it would become an arbitrary path-read/command
  primitive. See the security note below.
- Swagger is wired unconditionally (`app.UseSwagger()` / `app.UseSwaggerUI()`, not gated to
  Development) since this is an internal local tool with no auth anyway — revisit if that
  changes. UI at `/swagger`.
- **No authentication.** Every endpoint is anonymous by explicit decision, to be revisited once
  token-based auth and permissions are actually needed — don't add auth speculatively before that
  ask comes in.

## Security (read before touching the backend)

- **No authentication, by explicit decision (2026-09-18), not yet built.** Every endpoint is
  anonymous. Anyone who can reach the API or the Postgres port can read/write the full registry and
  read local git state (branch names, commit messages, file paths) for every configured agent.
  Token-based auth and per-endpoint permissions are planned as a later, separate pass — don't add
  auth speculatively before that's actually asked for, but don't forget it's still owed either.
- **Only ever run this bound to localhost**, and never publish the Postgres port beyond
  `127.0.0.1`. Do not change the default bind address to `0.0.0.0` or deploy it publicly reachable
  without adding real auth first.
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
cp .env.example .env   # first time only - set POSTGRES_PASSWORD
make db                # docker compose up -d postgres, localhost:5434
make migrate           # FluentMigrator: creates repos/agents tables
make backend           # http://localhost:5299, Swagger at /swagger
make frontend          # http://localhost:5173 (separate terminal/session)
```

Also first time: copy `backend/src/AgentFleetBoard.Api/appsettings.Local.json.example` to
`appsettings.Local.json` in that same folder and fill in the same `POSTGRES_PASSWORD` you put in
`.env` (both are gitignored, never commit either).

On this machine Postgres already has Alice/Bob/Dua's real worktree paths seeded in (inserted
directly via `docker exec ... psql`, not through a migration — see Architecture above). A fresh
clone's DB starts empty; use the Manage tab in the UI, or the `POST /api/repos` / `POST
/api/agents` / `.../assign` curl calls in README.md, to populate it.

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

`docs/PHASE-2-BUILD-PLAN.md`'s Phase 1 (repo registry), Phase 2 (agent registry + assignment), and
Phase 3 (registry management UI) are all **done** — see the Architecture section above. The
backend has also since moved off the JSON-file registry that build plan originally specified and
onto Postgres + a layered project structure (Domain/Persistence/Migrations/Api), by explicit
request, not from the build plan itself — the plan's *endpoints and behavior* are still the spec;
only the storage mechanism changed. Phase 4 (manual-launch/prepare-prompt bridge) and real dispatch
(Phase 2c in `docs/ROADMAP.md`) are still not started.

Do not start implementing further phases without asking the user to confirm scope —
`docs/ROADMAP.md` is context to resume the conversation from, not a spec to build from silently.
