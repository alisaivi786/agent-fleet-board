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

**1. Configure your agents.** Copy the example and fill in real paths:

```bash
cp backend/appsettings.Local.json.example backend/appsettings.Local.json
```

Edit `backend/appsettings.Local.json`:

```json
{
  "AgentFleet": {
    "Agents": [
      { "Name": "Alice", "Role": "Senior Software Engineer", "RepoPath": "C:\\path\\to\\repo", "BaseBranch": "develop" }
    ]
  }
}
```

`appsettings.Local.json` is gitignored — your real filesystem paths never get committed.

**2. Run the backend:**

```bash
cd backend
dotnet run --urls http://localhost:5299
```

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
