# Agent Guidance

MerHouse was built with agent-assisted engineering workflows. This file gives coding agents a compact, tracked starting point for working in the repository.

## Roadmap Guidance

Read `docs/architecture/roadmap.md` before changing code, documentation, scripts, deployment configuration, database migrations, or repository publication state. Treat it as the project roadmap and quality source of truth.

The roadmap QC rules are mandatory acceptance criteria, not advisory notes. Before making a meaningful change:

- Read the Roadmap QC Rules and Change Quality Rule sections.
- Translate the relevant QC rules into concrete checks for the task.
- Identify whether the change touches the future publication boundary, private notes, scripts, CI, docs, database, backend behavior, frontend behavior, or repository metadata.
- Check the visible user-facing result, not only the implementation detail. For example, GitHub Actions naming means both the workflow name and visible run title.
- Add or update focused tests for newly added or materially changed behavior. Tests should assert the durable user-facing contract, current invariant, and how the change works with surrounding components, permissions, states, and flows without clunky transitions or broken handoffs; do not preserve obsolete fixture counts, incidental ordering, or implementation timing.
- If code, documentation, scripts, CI behavior, or repository publication state disagree with the roadmap, fix the disagreement or call it out before closing the task.
- Do not mark work complete until the matching proof from the Change Quality Rule has passed or the remaining gap is explicitly documented.

If the roadmap is absent, work from the tracked project source only:

- [README.md](README.md) for product scope, setup, and common commands.
- [docs/index.md](docs/index.md) for architecture and development documentation.
- [scripts/quality/check.ps1](scripts/quality/check.ps1) for the broad local quality check.

## Repository Shape

- `backend/` contains the Spring Boot API, domain services, repositories, Flyway migrations, and backend tests.
- `frontend/` contains the React application, route configuration, API client, components, pages, Vitest tests, and Playwright tests.
- `docs/` contains engineering documentation for the current local-development codebase.
- `scripts/local/` contains local runtime helpers.
- `scripts/quality/` contains verification helpers.
- `scripts/maintenance/` contains cleanup helpers.
- `.notes/` contains private Obsidian working notes, dashboards, QC notes, and templates.
- `private/` contains private references and non-public operational context.

## Publication Boundary

The future public repository is expected to contain only `backend/` and `frontend/`. Treat those folders as publishable app source even though this working repository is private.

Do not add sensitive material to `backend/` or `frontend/`: real keys, tokens, credentials, private prompts, customer data, vendor account details, internal endpoints, database dumps, generated sensitive reports, production deployment details, or local `.env` files. Use environment variables, templates, or explicit external paths instead.

Local/demo credentials may exist only when they are obviously fake, development-scoped, and documented as such. If there is doubt, move the value outside the app folders or ask for clarification before implementing.

## Markdown And Obsidian

The repository root can be opened as an Obsidian vault. Use `.notes/00 Dashboard.md` as the private dashboard and `.notes/QC/Roadmap QC Checklist.md` for completion checks.

Keep markdown alive:

- Link notes to the roadmap, docs, source files, proof scripts, or follow-up notes.
- Promote durable decisions from `.notes/` into tracked docs when they affect architecture, setup, roadmap scope, quality rules, or future agent behavior.
- Do not let private notes become the only source of truth for product behavior or repository policy.
- Run `.\scripts\quality\markdown-check.ps1` after changing markdown or Obsidian links.

## Gap Closure

When you find a gap, close it before expanding scope when practical. Gaps include stale docs, missing proof, script/doc drift, CI naming drift, unsafe publication-boundary content, broken markdown links, prototype behavior without labels, and private facts embedded in app source.

If you decide something is for later, future work, a later deliberate step, Pre-V16, V16, or VInfinite, write it down before closing the task. Use the affected tracked architecture doc for design decisions, `docs/architecture/roadmap.md` for phase or version ownership, and an active `.notes/` page for working context that links back to the durable doc. Do not leave deferred decisions only in chat.

If a gap cannot be closed in the current change, record it in the roadmap, a tracked doc, or a current QC note with:

- what is wrong
- why it matters
- who or what owns the next action
- what proof will close it

## Working Standard

Keep changes focused, keep documentation aligned with the code, and run the checks that match the affected area. This repository is a private working workspace. The intended future publication boundary is a separate repository containing only `backend/` and `frontend/`; private operational material may be tracked in this private repo, but it must live outside those application folders and be referenced through paths, environment variables, or templates rather than embedded in the future public app source. Sensitive information of any kind must not be hard-coded in `backend/` or `frontend/`: keys, tokens, credentials, private prompts, customer data, vendor account details, internal endpoints, operational secrets, or generated sensitive reports. SaaS production readiness belongs to the V16 roadmap phase.

When reporting completion, name the QC proof that was run and any QC rule that shaped the change. If proof was intentionally skipped, say why and name the remaining risk. If a requested shortcut would weaken the roadmap QC rules, stop and explain the conflict instead of silently taking the shortcut.
