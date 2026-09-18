# Agent Fleet Board

A small dashboard that shows the real git status of a fleet of local agent working trees — branch,
last commit, ahead/behind vs. a base branch, and uncommitted files — refreshed live.

It reads whatever local paths you configure; it has no idea what an "agent" actually is beyond
"a git working tree I should watch." Point it at anything: a `git worktree` checkout used by a
background coding agent, a regular feature branch, a teammate's clone — anything with a `.git`.

## Stack

- `backend/` — ASP.NET Core (.NET 10) minimal API. Shells out to the local `git` binary against
  server-configured paths only (never a client-supplied path) and returns JSON.
- `frontend/` — React + Vite + TypeScript. Polls the API every 5s.

## Running it locally

**1. Run the backend:**

```bash
cd backend
dotnet run --urls http://localhost:5299
```

**2. Register a repo and an agent** through the API (persisted to `backend/data/repos.json` /
`agents.json`, gitignored — your real filesystem paths never get committed):

```bash
curl -X POST http://localhost:5299/api/repos \
  -H "Content-Type: application/json" \
  -d '{"name":"my-repo","path":"C:\\path\\to\\repo","baseBranch":"develop"}'
# -> { "id": "...", "name": "my-repo", ... }

curl -X POST http://localhost:5299/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","role":"Senior Software Engineer"}'
# -> { "id": "...", "name": "Alice", "assignedRepoId": null }

curl -X POST http://localhost:5299/api/agents/<agent-id>/assign \
  -H "Content-Type: application/json" \
  -d '{"repoId":"<repo-id>"}'
```

`GET /api/agents` then shows live git status for Alice against that repo. `DELETE
/api/repos/{id}` and `DELETE /api/agents/{id}` remove entries; `POST /api/agents/{id}/unassign`
clears an assignment without deleting the agent.

**3. Run the frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

## Security note

This API has no authentication and, given a configured path, will run `git` against it and
return whatever it finds (branch names, commit messages, file paths). **Only ever run it bound to
localhost.** Do not deploy it publicly reachable as-is.

## Status

This is a read-only status viewer today — it does not launch agents or send them work. That's a
deliberate scope boundary for now, not a missing feature; a "create/dispatch an agent from the UI"
control plane is a separate, larger piece of work. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the
full plan, open questions, and phasing.
