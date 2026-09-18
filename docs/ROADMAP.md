# Roadmap — from status viewer to agent control plane

This is the full high-level plan behind Agent Fleet Board, written so a future session (or
teammate) can resume the "Phase 2" work without re-deriving scope from scratch. `CLAUDE.md` at the
repo root has the short version and the operational facts (security rules, deploy setup); this
document has the vision, the architecture options, and the open questions.

## Where this is going

Today (v1): a read-only dashboard that shows the git status of a fixed list of local working
trees you configure by hand in a JSON file.

The stated end goal: a UI where you can **create an agent, point it at any repo, hand it a prompt,
and watch it work** — with the dashboard's live status view becoming one panel inside a real
control plane, not the whole product. Quoting the user's own framing of the constraint: *"no agent
will work without an active Claude account"* — this is not a multi-tenant SaaS with its own auth
system; it's a tool that supervises real Claude Code sessions running under your own login.

## User stories (target end state)

1. **As the operator**, I add a repo (any repo — backend, frontend, infra, doesn't matter) to a
   registry once, instead of hand-editing a JSON file per agent.
2. **As the operator**, I create an agent with a name/role, and assign it to any registered repo
   **per task** — not a fixed, permanent binding. (Already decided — see "Decisions locked in".)
3. **As the operator**, I type a prompt into the UI, pick an agent + repo, and hit go. Behind the
   scenes, something launches (or resumes) a real Claude Code session scoped to that repo with
   that prompt.
4. **As the operator**, I watch that agent's output/log live in the UI — not just git-status
   snapshots, but what it's actually doing right now.
5. **As the operator**, when it's done, I see what changed (files, commits) and can review before
   anything ships — this dashboard's existing git-status view is exactly that "what changed" panel,
   just needs to be reachable per-session instead of only per-worktree-at-rest.

## Decisions locked in (don't re-litigate these)

- **Agent-repo binding is assignable per task, not fixed.** Rejected the "Alice always does
  frontend" model.
- **v1 stays scoped to read-only status.** Phase 2 is additive, not a rewrite — the existing
  `GET /api/agents` reads real git state and that capability is still needed once sessions are
  live (arguably more useful, since a live session's working tree changes constantly).
- **Everything stays local-first.** No hosted multi-user backend implied by anything discussed so
  far — this runs on the operator's own machine against their own Claude login.

## Open questions — resolve these before writing Phase 2 code

These are genuinely unresolved. Do not guess an answer and start implementing; ask the user.

1. **How does a session actually get launched?** Candidates, roughly in order of how much new
   infrastructure they need:
   - Shell out to the `claude` CLI as a subprocess per agent, capture stdout/stderr, restart on
     crash. Simplest, closest to how this dashboard's own `GitStatusReader` already shells out to
     `git` — same trust model (server-side process, not client-controlled).
   - Something using the Claude Agent SDK directly inside the backend, driving sessions
     programmatically instead of shelling out to the CLI. More control, more surface area.
   - Point at an *already-running* Claude Code session (like this repo's own worktree-based agents
     were driven manually) rather than the tool launching anything itself — i.e. stay a viewer,
     never a launcher. This avoids the biggest security question entirely (see below) at the cost
     of the "assign a prompt from the UI" story.
2. **How do logs/output stream to the UI live?** Server-Sent Events, WebSocket, or simplest-first
   (poll a log file the way `/api/agents` already polls git) — likely start with polling and
   upgrade only if latency actually matters in practice.
3. **What does "connect to repo" mean?** Clone fresh into a managed location, or point at an
   existing local checkout/worktree the way v1 does? These have very different failure modes
   (disk space, auth-to-clone-private-repos, path collisions).
4. **Does `/api/agents` merge into a bigger control-plane API, or stay a separate read-only
   endpoint the new one composes with?** Leaning toward "stays separate, new endpoints compose
   with it" to avoid destabilizing something that already works, but not decided.
5. **Security boundary for prompt dispatch.** v1's entire security model rests on "paths are
   server-config only, never client-supplied" (see `CLAUDE.md`). A UI that lets the client say
   "run agent X against repo Y with prompt Z" **breaks that assumption on purpose** — Y must come
   from a server-side allowlist (the repo registry from user story 1), never a raw path typed into
   a request. This needs a real design pass before any code, not an afterthought.

## Rough phasing (not committed, just a reasonable shape)

- **Phase 2a — Repo registry, no launching yet.** Add a way to register repos through the UI
  (replacing hand-edited `appsettings.Local.json`) and assign an agent name to a repo *for
  display purposes only*. Still read-only. Low risk, directly extends v1.
- **Phase 2b — Manual-launch bridge.** UI shows "run this prompt" but it only *prepares* a command
  you copy/paste into your own terminal — no subprocess spawning by the backend yet. Validates the
  UX without touching the hard security question.
- **Phase 2c — Real dispatch.** Backend actually launches a session (subprocess or SDK — resolve
  open question #1 first) against a registry-allowlisted repo, streams output back.
- **Phase 2d — Whatever falls out of using 2c for real.** Don't plan this far ahead yet.

Treat this phasing as a suggestion to react to, not a commitment — confirm scope with the user
before starting any phase.
