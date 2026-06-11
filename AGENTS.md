# Agent Guidance

MerHouse was built with agent-assisted engineering workflows. This file gives coding agents a compact, tracked starting point for working in the repository.

## Roadmap Guidance

Read `docs/architecture/roadmap.md` before changing code, documentation, scripts, deployment configuration, database migrations, or repository publication state. Treat it as the project roadmap and quality source of truth.

The roadmap QC rules are mandatory acceptance criteria, not advisory notes. Before making a meaningful change:

- Read the Roadmap QC Rules and Change Quality Rule sections.
- Translate the relevant QC rules into concrete checks for the task.
- Identify whether the change touches repository shape, scripts, CI, docs, database, backend behavior, frontend behavior, or repository metadata.
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
- `docs/` is the durable project documentation layer. Keep lasting project decisions there.

## Repository Boundary

The repository is meant to be readable by a developer who just cloned it. Keep source, docs, scripts, CI, compose files, root configuration, and agent guidance useful and current.

The current public-facing posture is local-certified project/codebase, not production SaaS launch. V16.2 local convergence evidence is recorded in `docs/architecture/cross-surface-convergence.md`; cloud deployment, app-store release, production monitoring, provider-backed delivery, backup/restore operations, and incident response belong to V17 activation only when the roadmap and active branch deliberately say so.

V17 production work is private until the deployment is proven. Keep VPS env files, SMTP credentials, Android keystores, signed APK/AAB artifacts, deployment logs, backup artifacts, provider details, and live URLs out of Git unless the roadmap and public docs deliberately publish sanitized values. Repo-local private material may live under ignored workspaces such as `private/`, `.secrets/`, or `deploy/private/`; do not force-add those files.

During V17 production activation, do not refactor unless a concrete problem requires it: failing proof, deployment blocker, security/runtime boundary issue, performance bottleneck, real duplication or coupling that blocks deployment, or a documented V&V/QC/QA defect. Do not start cosmetic, speculative, or architecture-ideal refactors while deployment proof is waiting on real external inputs.

Keep local-only values and working context out of Git. Use environment variables, templates, ignored files, or explicit external paths for anything that belongs to one machine or one deployment.

Local/demo credentials may exist only when they are obviously fake, development-scoped, and documented as such. If there is doubt, keep the value out of the repository or ask for clarification before implementing.

## Markdown

Keep markdown alive:

- Link docs to the roadmap, source files, proof scripts, or follow-up architecture pages.
- Promote durable decisions into tracked docs when they affect architecture, setup, roadmap scope, quality rules, or future agent behavior.
- Keep local notes and one-off working context outside the repository; promote lasting decisions into docs.
- Run `.\scripts\quality\markdown-check.ps1` after changing markdown.

## Gap Closure

When you find a gap, close it before expanding scope when practical. Gaps include stale docs, missing proof, script/doc drift, CI naming drift, repository-boundary drift, broken markdown links, prototype behavior without labels, and local-only facts embedded in source.

If you decide something is for later, future work, a later deliberate step, Pre-V16, V16, V17, or VInfinite, write it down before closing the task. Use the affected tracked architecture doc for design decisions and `docs/architecture/roadmap.md` for phase or version ownership. Do not leave deferred decisions only in chat.

If a gap cannot be closed in the current change, record it in the roadmap, a tracked doc, or a current QC note with:

- what is wrong
- why it matters
- who or what owns the next action
- what proof will close it

## Working Standard

Keep changes focused, keep documentation aligned with the code, and run the checks that match the affected area. Write docs, scripts, CI, and app source for a future reader, not just for the current local session. V16.2 belongs to completed deployment-ready local certification; V17 production activation belongs to the private deployment phase until external proof and an intentional publication decision make it public.

When reporting completion, name the QC proof that was run and any QC rule that shaped the change. If proof was intentionally skipped, say why and name the remaining risk. If a requested shortcut would weaken the roadmap QC rules, stop and explain the conflict instead of silently taking the shortcut.
