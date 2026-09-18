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
  frontend/   React + Vite + TypeScript — sidebar-nav shell (Sidebar.tsx), polls every N seconds
  Makefile    make db | migrate | backend | frontend | dev | install | build
```

**Frontend nav (2026-09-18 redesign):** `App.tsx` is a thin shell (fetch/poll all four collections -
agents, repos, projects, activity - then render a page by `Tab`) around `Sidebar.tsx`. Pages live in
`frontend/src/pages/`: `DashboardPage` (stat cards + real Repositories/Activity/System-Health/Active-
and-Idle-Agents panels, all linking into the pages below rather than duplicating their forms),
`RepositoriesPage` (read-only repo/agent/project cross-reference table), `AgentsPage` (the roster
grid - search, status-filter stat tiles, `AgentCard`s - unchanged from before, just extracted out of
`App.tsx`), `ActivityPage` (full `ActivityFeed`), and `ManagePage` (unchanged: `RepoManager` +
`ProjectManager` + `AgentManager`, i.e. all create/delete forms still live here, not duplicated per
page). `Projects` renders `ProjectShowcase` directly, no wrapper needed. **Deliberately dropped from
the design brief that inspired this:** a "Queue Depth"/"Agent Heartbeat" system-health panel with
made-up numbers - this app doesn't have a scheduler or heartbeat mechanism, so it doesn't pretend to.
CPU/RAM in `SystemHealthPanel.tsx` are real host metrics (see below), kept because they're real.

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
- **Projects (2026-09-18):** `003_CreateProjects.cs` adds a `projects` table (`id`, `name`,
  `repo_id`) and an `agents.project_id` nullable FK (`ON DELETE SET NULL`). A project groups agents
  for display so you can see "what's this codebase's fleet doing" at a glance, not just a flat
  agent list. **Deliberately a grouping label, not a hard repo lock** — real usage has multiple
  agents each on their own git worktree of the *same* logical project (e.g. Alice/Bob/Dua each have
  a separate `alice-repo`/`bob-repo`/`dua-repo` registry entry for their own `FMS-Prime` worktree),
  so forcing every agent in a project onto one shared repo would have broken their individual git
  status tracking the first time this was tried. `AssignProjectAsync` only fills in
  `AssignedRepoId` from the project's `RepoId` when the agent doesn't have one yet
  (`agent.AssignedRepoId ??= project.RepoId`) — an agent that already tracks a repo keeps it, full
  stop. The plain `AssignAsync` (direct repo pick) no longer touches `ProjectId` either way. **Once
  an agent has a repo/branch assigned, nothing changes it out from under the agent except an
  explicit assign/unassign call** — this matters at scale (100+ agents is an explicit target),
  where silent reassignment would be impossible to audit.
- **`Project.RepoId`/`BaseBranch` are both optional, and both purely descriptive/default metadata,
  never authoritative (2026-09-18, migrations `004`/`005`):** `RepoId` was originally `NOT NULL`
  with `ON DELETE CASCADE`, which forced every project creation to pick one specific repo even
  though (per the point above) a project's agents commonly run against *different* repos - the UI
  then displayed that one nominal repo as if it were "the project's repo," which is exactly the
  confusion this was built to avoid. Fixed by dropping the `NOT NULL` (FK is now `ON DELETE
  SET NULL`) and adding an equally-optional `base_branch` text column. **Neither field feeds into
  git-status computation** — ahead/behind for every agent always comes from its own repo's
  `RepoDefinition.BaseBranch`, set at repo-registration time; a project's `BaseBranch` is describing
  intent (e.g. "this project's work targets `develop`"), not overriding anything. `ProjectShowcase.tsx`
  reflects this: instead of showing `Project.RepoId`'s name as a single badge, it derives and shows
  the *actual* distinct repo names currently in use by that project's agents.
- **Worktree auto-discovery (2026-09-18):** most real usage is one agent per git worktree under a
  shared repo (Claude Code's own `.claude/worktrees/<name>` convention is the common case), not one
  hand-typed repo entry per agent. `POST /api/repos/{id}/discover-worktrees`
  (`WorktreeScanner.cs`, shells out to `git worktree list --porcelain` against the registry-resolved
  repo path only, same rule as `GitStatusReader`) finds every *linked* worktree (the main worktree
  is skipped - that's already the registered repo), registers a repo entry for each new path, and
  creates+assigns a new agent named after the worktree's folder if no existing agent already points
  there. Idempotent - safe to re-run after manually renaming agents, since it only acts on repos/
  agents that don't exist yet. Exposed as a "Discover worktrees" button per repo row in
  `RepoManager.tsx`.
- **The "Working" pill was renamed "Diverged" (2026-09-18)** because it was never actually about a
  live process — `isWorking()` just means "git shows this branch ahead of base or has uncommitted
  changes," which can stay true indefinitely with nothing running (e.g. an agent with commits ahead
  of `develop` that haven't been merged yet). Calling that "Working" repeatedly led to "why can't I
  stop/free this agent" confusion, because there is genuinely nothing to stop - the pill isn't
  reporting a session at all. A real running session (tracked via `AgentSession`/`SessionRunner`)
  is a completely separate concept, surfaced distinctly: `AgentCard.tsx`'s "Session running" banner
  and Dashboard's per-agent Stop button only ever appear when a session's `Status` is actually
  `Running`, never derived from git state.

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
- **`GET /api/sessions`** (2026-09-18): recent sessions across every agent (capped at 100, newest
  first), joined with agent name for display - backs the Activity Log/Dashboard, not just the
  per-agent `GET /api/agents/{id}/sessions`.
- **`GET /api/system/metrics`** (2026-09-18): real host CPU/RAM from `SystemMetricsSampler`, a
  `BackgroundService` sampling Win32 `GetSystemTimes`/`GlobalMemoryStatusEx` via raw P/Invoke every
  2s (no `PerformanceCounter` package needed). Windows-only; reports `{ supported: false, ... }`
  elsewhere instead of throwing. **This is the one piece of the dashboard mockup that got a real
  implementation instead of being dropped** - see the Frontend nav note above for what else from
  that mockup was intentionally left out because nothing here produces that data.

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
make backend           # http://localhost:5390, Swagger at /swagger
make frontend          # http://localhost:5173 (separate terminal/session)
```

Also first time: copy `backend/src/AgentFleetBoard.Api/appsettings.Local.json.example` to
`appsettings.Local.json` in that same folder and fill in the same `POSTGRES_PASSWORD` you put in
`.env` (both are gitignored, never commit either).

**Port history (2026-09-18):** the API originally ran on `:5299`, which turned out to collide with
an unrelated project's Docker container (`zkteco-wiremock-dev`, port-forwarding host `5299` -> its
own container's `8080` - it's WireMock.Net under the hood, so it also happens to say `Server:
Kestrel` in its responses, easy to mistake for this app misbehaving). Windows allows two processes
to both bind the same port when one binds the wildcard address and the other binds a specific one,
so requests silently round-robinned between the real API and WireMock's mock server, producing
intermittent, unexplainable 404s in the frontend with no server-side error at all. **Moved this
API to `:5390` instead of touching the other project's container or port** - do not run `docker
stop`/`docker start` on containers this project doesn't own as a "fix"; move *this* app's port
instead if a collision ever recurs. `Makefile`, `README.md`, `CLAUDE.md`, `frontend/src/api.ts`'s
default `API_BASE`, and `launchSettings.json`'s `http`/`https` profiles are all kept in sync -
update all of them together if the port ever needs to change again. If you see
inconsistent 200/404s on the same endpoint with no exception logged, suspect a host port collision
with some other locally-running service before suspecting the code - check with `netstat -ano |
findstr :<port>` and `docker ps` for anything else publishing that port.

On this machine Postgres already has Alice/Bob/Dua's real worktree paths seeded in (inserted
directly via `docker exec ... psql`, not through a migration — see Architecture above). A fresh
clone's DB starts empty; use the Manage tab in the UI, or the `POST /api/repos` / `POST
/api/agents` / `.../assign` curl calls in README.md, to populate it.

Also seeded directly the same way (2026-09-18): a `FMSPrime-backend` project, with Alice/Bob/Dua's
`project_id` backfilled to it via a plain `UPDATE agents SET project_id = ... WHERE id IN (...)` —
their `assigned_repo_id` was deliberately left untouched (each keeps its own worktree repo). This
was done directly against Postgres, not via the live API, specifically because the API process
running at the time still had the pre-2026-09-18 stricter build (the one that force-overwrote an
agent's repo on project assignment) — going through it would have clobbered all three agents' repo
assignments. Once the backend is restarted onto the current code, the same result is reachable via
`POST /api/agents/{id}/assign-project` for any newly-added agent that doesn't have a repo yet.

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

`docs/PHASE-2-BUILD-PLAN.md`'s Phase 1 (repo registry), Phase 2 (agent registry + assignment),
Phase 3 (registry management UI), and Phase 4 (manual-launch/prepare-prompt bridge) are all
**done** — see the Architecture section above. `POST /api/agents/{id}/prepare-prompt` formats a
`cd "<path>" && claude "<prompt>"` command server-side from the registry-resolved path; it does not
execute anything. The backend has also since moved off the JSON-file registry that build plan
originally specified and onto Postgres + a layered project structure
(Domain/Persistence/Migrations/Api), by explicit request, not from the build plan itself — the
plan's *endpoints and behavior* are still the spec; only the storage mechanism changed.

**Real dispatch (Phase 2c) is now built, with scope confirmed by the user (2026-09-18): subprocess
launch (not the Agent SDK), logs via polling a file (not SSE/WebSocket).** `POST
/api/agents/{id}/sessions` spawns a real `claude -p "<prompt>"` subprocess against the agent's
registry-resolved repo path (see `SessionRunner.cs` in `AgentFleetBoard.Api` and `AgentSession` in
`AgentFleetBoard.Domain`/the `agent_sessions` table). `GET /api/agents/{id}/sessions` /
`GET /api/sessions/{id}` / `GET /api/sessions/{id}/log` / `POST /api/sessions/{id}/stop` round out
the lifecycle. This is the point where the tool's security model changed shape — a client-triggered
subprocess spawn is a different risk class than anything built before it. Still no auth: anyone who
can reach this API can trigger a real coding session against any registered repo.

**Confirmed working end-to-end (2026-09-18)** once the `claude` CLI was actually installed - see
the blocking-issue note below for why that took a while. Real dispatch is no longer purely
theoretical; it has actually run and completed a session successfully.

**Known v1 limitations of real dispatch, not oversights:**
- Running processes are tracked **in-memory only** (`SessionRunner`'s `ConcurrentDictionary`). An
  API restart loses the ability for `Stop()` (now `POST /api/sessions/{id}/stop`) to find the OS
  process - its DB row and log file survive, but it'd never transition out of `Running` on its own
  after that. Mitigated, not fully solved, by `POST /api/sessions/{id}/force-stop`: it still tries
  `runner.Stop(id)` first, but falls back to killing the last-known `ProcessId` directly via
  `Process.GetProcessById` (best-effort - the OS may have recycled that pid into something
  unrelated by then, hence the narrow catch), and *always* forces the DB row to `Stopped` either
  way so the agent shows as free again. `SessionPanel.tsx`'s single "Stop" button calls this, not
  the plain `stop` endpoint - always prefer `force-stop` from the UI.
- `AgentCard.tsx` has a single "Assign work" toggle that opens `SessionPanel.tsx` — one form with
  "Copy command" (formats a string, same as the old Phase 4 `prepare-prompt` action) and "Run now"
  (behind a custom `ConfirmDialog.tsx`, not `window.confirm`) side by side. On open, the panel calls
  `GET /api/agents/{id}/sessions` to recover that agent's most recent session, so reopening the
  panel (or reloading the page) after a session was started can still see and force-free it — it's
  not purely in-memory client state.

**Blocking issue as of 2026-09-18, confirmed by the user - `claude` is not installed as a
standalone CLI on this machine.** The user only uses Claude Code through the IDE/VS Code
extension, not a separate terminal binary. `SessionRunner` can be fixed for every *mechanical*
Process.Start issue (see below) and it will still fail with "'claude' is not recognized..." until
a real `claude` CLI exists on PATH. **Do not spend more time debugging `SessionRunner`'s spawn
mechanics without first confirming the CLI is actually installed and on PATH** - re-diagnose by
running `claude --version` in an ordinary terminal before touching this code again. This is the
reason real dispatch has still never been exercised end-to-end, on top of the earlier
harness-safety-classifier blocker (see below) that prevented testing it from this session anyway.

Two mechanical bugs were found and fixed in `SessionRunner.BuildStartInfo`/`Start` while
diagnosing the above (neither is sufficient on its own without the CLI existing, but both are real
fixes worth keeping):
1. `Process.Start` with `UseShellExecute = false` uses `CreateProcess` directly, which - unlike a
   real shell - doesn't search `PATHEXT` or resolve `.cmd`/`.bat` npm shims by a bare name like
   `"claude"`. Fixed by routing through `cmd.exe /c claude ...` on Windows, which resolves PATH and
   PATHEXT the way a terminal would.
2. That fix initially passed the user's prompt as a literal `cmd.exe` command-line argument, which
   would let cmd.exe's own quoting rules (`&`, `|`, `%`, `^`, ...) reinterpret untrusted prompt text
   as command syntax - a command-injection surface, correctly flagged by the harness's safety
   classifier ("Create RCE Surface") when committing it. Fixed by keeping the `cmd.exe`/`claude -p`
   command line fixed (no user input in it at all) and delivering the prompt over the child
   process's redirected stdin instead - a data channel that's never parsed as command syntax by
   anything.

**Separately, starting the API to test any of this autonomously was blocked by the harness's own
safety classifier ("Create Unsafe Agents") once the code could spawn `claude` subprocesses** - by
design, not a bug to work around. The build compiled clean, the migration applied clean, and the
frontend typechecks/lints/builds clean, but the actual dispatch path (spawn → log capture → exit →
status update, and the UI polling loop that watches it) still needs a live test by a human - and
that test will keep failing on "'claude' is not recognized" until the CLI is actually installed.
**Do not assume the "Run" button in the UI works until both issues are resolved and a human has
clicked it.**
