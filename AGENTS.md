# AGENTS

This repository implements the AI Car Sales Assistant & CRM Platform foundation for Day 2.

## Core rules

- Maintain a multi-tenant SaaS architecture and keep each dealership data boundary isolated.
- Keep the backend as a modular monolith and do not implement unauthorized business logic.
- Treat dealership inventory as a read-only source of truth managed by an authorized adapter layer.
- Keep secrets out of source control and use `.env` files only for local development.
- Use Docker for PostgreSQL and Redis local infrastructure.
- Prefer pnpm workspaces and keep the frontend/backend packages aligned on shared types.

## Execution notes

- Use the root workspace scripts for local dev, testing, and build validation.
- The API lives at `http://localhost:4000/api/v1` and the web app at `http://localhost:3000`.
- The health endpoint validates actual PostgreSQL and Redis connectivity.
- Do not implement unapproved CRM or AI business features in this phase.

## GIT COMMIT AND ATTRIBUTION POLICY

- Use the repository-local Git identity `Deepthi Devindi <deepthidevindi0@gmail.com>` for commits the owner has reviewed and approved. Do not modify global Git configuration or impersonate another contributor.
- Do not add a `Co-authored-by: Copilot` trailer by default or fabricate attribution. Preserve attribution required by repository policy or applicable agreements.
- For each completed development day, target exactly five meaningful, working milestone commits. Do not split work artificially to reach five; if fewer meaningful milestones are completed, report the actual count and why.
- Use Conventional Commit messages with an accurate type and scope, such as `feat(database): ...`, `fix(api): ...`, `refactor(api): ...`, `test(database): ...`, `docs(day-03): ...`, or `chore(repo): ...`.
- Before each commit, review the changed files, check for accidental secrets and excluded files, run relevant validation, verify the milestone works, and stage only the intended files. Never blindly stage all changes.
- Create local commits only after the owner reviews and approves the completed milestone and its changes. Do not commit empty, broken, or unfinished work as complete.
- Work on the existing development branch. Do not force-push, reset or rewrite history, rebase published commits without approval, delete branches, change remotes, or alter repository ownership. Do not push automatically; obtain the owner's approval before pushing.
- At the end of each development day, report the day number, completed tasks, planned milestones, actual commit count/hashes/messages, author and committer verification, tests/results, outstanding problems, Git status, and push readiness. Verify recent commits with `git log -5 --format="%h | %an <%ae> | %cn <%ce> | %s"` and check for unexpected co-author trailers. Report actual results; do not claim five commits unless history confirms them.
