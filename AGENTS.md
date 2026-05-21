# Agent Guidance

MerHouse was built with agent-assisted engineering workflows. This file gives coding agents a compact, tracked starting point for working in the repository.

## Roadmap Guidance

Read `docs/architecture/roadmap.md` before changing code, documentation, scripts, deployment configuration, database migrations, or repository publication state. Treat it as the project roadmap and quality source of truth.

The roadmap QC rules are mandatory acceptance criteria, not advisory notes. Before making a meaningful change:

- Read the Roadmap QC Rules and Change Quality Rule sections.
- Translate the relevant QC rules into concrete checks for the task.
- Check the visible user-facing result, not only the implementation detail. For example, GitHub Actions naming means both the workflow name and visible run title.
- If code, documentation, scripts, CI behavior, or repository publication state disagree with the roadmap, fix the disagreement or call it out before closing the task.
- Do not mark work complete until the matching proof from the Change Quality Rule has passed or the remaining gap is explicitly documented.

If the roadmap is absent, work from the tracked public source only:

- [README.md](README.md) for product scope, setup, and common commands.
- [docs/index.md](docs/index.md) for architecture and development documentation.
- [scripts/quality/check.ps1](scripts/quality/check.ps1) for the broad local quality check.

## Repository Shape

- `backend/` contains the Spring Boot API, domain services, repositories, Flyway migrations, and backend tests.
- `frontend/` contains the React application, route configuration, API client, components, pages, Vitest tests, and Playwright tests.
- `docs/` contains public engineering documentation for the current local-development codebase.
- `scripts/local/` contains local runtime helpers.
- `scripts/quality/` contains verification helpers.
- `scripts/maintenance/` contains cleanup helpers.

## Working Standard

Keep changes focused, keep public documentation aligned with the code, and run the checks that match the affected area. Treat public-facing CI, docs, scripts, and repository metadata as part of the product surface. The repository is public-source and local-development ready; SaaS production readiness belongs to the V16 roadmap phase.

When reporting completion, name the QC proof that was run and any QC rule that shaped the change. If a requested shortcut would weaken the roadmap QC rules, stop and explain the conflict instead of silently taking the shortcut.
