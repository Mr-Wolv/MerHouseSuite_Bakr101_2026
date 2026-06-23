# Agent Guidance

MerHouse was built with agent-assisted engineering workflows. This file gives coding agents a compact, tracked starting point for working in the repository.

## Roadmap Guidance

Read `docs/architecture/roadmap.md` before changing code, documentation, scripts, deployment configuration, database migrations, or repository publication state. Treat it as the project roadmap and quality source of truth.

For V17-specific scope decisions, also read [`V17-RE-EVALUATION.md`](docs/refactor/V17-RE-EVALUATION.md). The re-evaluation is an additional source of truth that reclassifies deployment infrastructure as complete and focuses remaining V17 work on three portfolio features (Access Request & Approve-and-Activate, Password Recovery via Firebase Auth, How To Use Page). AI Assistant Completion is deferred to Vinfinite. When the roadmap and re-evaluation disagree on V17 scope, the re-evaluation takes precedence. The roadmap retains authority over QC rules, repository rules, and the Change Quality Rule.

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
- `docs/` contains engineering documentation for the current codebase, local development path, and private V17 deployment path.
- `scripts/local/` contains local runtime helpers.
- `scripts/quality/` contains verification helpers.
- `scripts/maintenance/` contains cleanup helpers.
- `docs/` is the durable project documentation layer. Keep lasting project decisions there.

## Repository Boundary

The repository is meant to be readable by a developer who just cloned it. Keep source, docs, scripts, CI, compose files, root configuration, and agent guidance useful and current.

The current public-facing posture is local-certified project/codebase plus **confirmed live** private V17 deployment (Neon PostgreSQL, Hugging Face Docker Space backend, Vercel frontend, GitHub Actions CI/CD, GitHub Release APK distribution). V16.2 local convergence evidence is recorded in `docs/quality/cross-surface-convergence.md`; the three V17 portfolio features (Access Request & Approve-and-Activate, Password Recovery via Firebase Auth, How To Use Page) are implemented in the current codebase as documented in [`V17-RE-EVALUATION.md`](docs/refactor/V17-RE-EVALUATION.md). AI Assistant Completion is deferred to Vinfinite. The remaining V17 work is closure convergence and deployed proof execution. Cloud deployment is confirmed; production monitoring, provider-backed delivery, backup/restore operations, incident response, and signed APK release proof are partially complete (scripts exist, deployment is live, some proof requires execution against the live stack).

V17 portfolio work is focused on closing and proving the implemented identity lifecycle: Access Request & Approve-and-Activate, Password Recovery via Firebase Auth, and the How To Use Page. AI Assistant Completion with conversation threading is deferred to Vinfinite. Keep deployment env files, SMTP credentials, Android keystores, signed APK/AAB artifacts, deployment logs, backup artifacts, provider details, and live URLs out of Git unless the roadmap and public docs deliberately publish sanitized values. Repo-local private material may live under ignored workspaces such as `private/`, `.secrets/`, or `deploy/private/`; do not force-add those files.

During V17 production activation, do not refactor unless a concrete problem requires it: failing proof, deployment blocker, security/runtime boundary issue, performance bottleneck, real duplication or coupling that blocks deployment, or a documented V&V/QC/QA defect. Do not start cosmetic, speculative, or architecture-ideal refactors while deployment proof is waiting on real external inputs.

For the first V17 portfolio release, keep scope focused. Finish and prove the three portfolio features on web/backend plus the existing signed Android release workflow and live walkthrough evidence. Live deployed browser and installed-Android tours take priority over screenshot-only or report-only proof; use scripts as supporting records, and edit product/deployment code only when the live tours expose concrete happy-path or unhappy-path defects. The agent is the only intentional v1 prototype: it remains read-plus-draft, deterministic-fallback, and non-mutating until a later provider/tool-authorization slice is deliberately designed and proven. After deployment, use CI/CD, deployed smoke/load/browser/mobile proof, and concrete defects to guide bug hunting.

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

Keep changes focused, keep documentation aligned with the code, and run the checks that match the affected area. Write docs, scripts, CI, and app source for a future reader, not just for the current local session. V16.2 belongs to completed deployment-ready local certification; V17 portfolio completion belongs to the confirmed live deployment phase with three implemented product features.

When reporting completion, name the QC proof that was run and any QC rule that shaped the change. If proof was intentionally skipped, say why and name the remaining risk. If a requested shortcut would weaken the roadmap QC rules, stop and explain the conflict instead of silently taking the shortcut.
