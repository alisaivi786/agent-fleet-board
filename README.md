# Agent Fleet Board

A small dashboard that shows the real git status of a fleet of local agent working trees — branch,
last commit, ahead/behind vs. a base branch, and uncommitted files — refreshed live.

It reads whatever local paths you configure; it has no idea what an "agent" actually is beyond
"a git working tree I should watch." Point it at anything: a `git worktree` checkout used by a
background coding agent, a regular feature branch, a teammate's clone — anything with a `.git`.

## Stack

- `backend/` — ASP.NET Core (.NET 10), split into four projects under `backend/src/`:
  `AgentFleetBoard.Domain` (the `RepoDefinition`/`AgentDefinition`/`Project` entities), `AgentFleetBoard.Persistence`
  (EF Core + Npgsql, backed by Postgres), `AgentFleetBoard.Migrations` (FluentMigrator, run
  separately from the API), and `AgentFleetBoard.Api` (the minimal API + Swagger). Shells out to
  the local `git` binary against registry-resolved paths only (never a client-supplied path) and
  returns JSON.
- `frontend/` — React + Vite + TypeScript. Polls the API every 5s.
- Postgres runs via `docker compose` — this tool doesn't ship its own DB.

## Running it locally

**1. Start Postgres and run migrations:**

```bash
cp .env.example .env   # edit POSTGRES_PASSWORD
make db                # docker compose up -d postgres, localhost:5434
make migrate           # creates the repos/agents tables
```

**2. Run the backend** (copy `backend/src/AgentFleetBoard.Api/appsettings.Local.json.example` to
`appsettings.Local.json` first and fill in the same Postgres password):

```bash
cd backend/src/AgentFleetBoard.Api
dotnet run --urls http://localhost:5390
```

Swagger UI is at `http://localhost:5390/swagger`. There's no authentication yet — every endpoint
is anonymous (see Security note below).

**3. Register a repo and an agent** through the API (persisted in Postgres, not committed - your
real filesystem paths never touch git):

```bash
curl -X POST http://localhost:5390/api/repos \
  -H "Content-Type: application/json" \
  -d '{"name":"my-repo","path":"C:\\path\\to\\repo","baseBranch":"develop"}'
# -> { "id": "...", "name": "my-repo", ... }

curl -X POST http://localhost:5390/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","role":"Senior Software Engineer"}'
# -> { "id": "...", "name": "Alice", "assignedRepoId": null }

curl -X POST http://localhost:5390/api/agents/<agent-id>/assign \
  -H "Content-Type: application/json" \
  -d '{"repoId":"<repo-id>"}'
```

`GET /api/agents` then shows live git status for Alice against that repo. `DELETE
/api/repos/{id}` and `DELETE /api/agents/{id}` remove entries; `POST /api/agents/{id}/unassign`
clears an assignment without deleting the agent. `POST /api/agents/{id}/prepare-prompt` (body
`{"prompt": "..."}`) returns a ready-to-run `{"command": "cd \"...\" && claude \"...\""}` for an
assigned agent — it only formats the string, nothing gets executed server-side. In the UI, this is
the "Prompt" button on each agent card in the Roster tab.

**Projects** group agents under a single bound repo: `POST /api/projects` (body `{"name": "...",
"repoId": "..."}`) creates one, `GET /api/projects` lists them, `DELETE /api/projects/{id}` removes
one. `POST /api/agents/{id}/assign-project` (body `{"projectId": "..."}`) binds an agent to a
project and always sets its repo to that project's repo in the same write — an agent bound to a
project can't be pointed at a different repo without unassigning the project first
(`POST /api/agents/{id}/unassign-project`). The Projects tab in the UI shows one card per project
with its agents, plus an "Unassigned agents" section.

**4. Run the frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

## Security note

This API has no authentication yet — every endpoint is intentionally anonymous for now (token-based
auth and per-endpoint permissions are a planned, separate pass, not an oversight). Given a
registered path, it will run `git` against it and return whatever it finds (branch names, commit
messages, file paths). **Only ever run it bound to localhost.** Do not deploy it publicly
reachable as-is.

## Status

Repos and agents are fully manageable through the UI, and the "Prompt" button prepares a
copy-pasteable command for an assigned agent — but this tool still doesn't launch or supervise
anything itself. That's a deliberate scope boundary, not a missing feature; a backend that actually
spawns/supervises a Claude Code session is a separate, larger piece of work with its own security
questions. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full plan, open questions, and phasing.
