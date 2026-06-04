# Roadmap QC Checklist

Use this before calling meaningful work done.

## Source Of Truth

- [ ] Re-read [[docs/architecture/roadmap|roadmap]] sections relevant to the change.
- [ ] Check [[AGENTS|agent guidance]] when the work changes repository policy, proof, or publication boundaries.
- [ ] Confirm this note does not create new durable truth that should live in tracked docs.
- [ ] If durable knowledge changed, update `README.md`, `docs/index.md`, or the affected `docs/` page.
- [ ] If notes changed, keep them linked from [[.notes/00 Dashboard|dashboard]] or another active note.

## Publication Boundary Safety

- [ ] No sensitive information was added to `backend/` or `frontend/`.
- [ ] No secrets, credentials, private keys, provider tokens, customer data, internal endpoints, private prompts, database dumps, or sensitive generated reports were added to app source.
- [ ] Local `.env` values and generated reports remain ignored.
- [ ] Anything private lives outside `backend/` and `frontend/` and is referenced by path, environment variable, or template.
- [ ] API/provider keys, tokens, private prompts, vendor account details, customer data, internal endpoints, and operational credentials are not hard-coded in app source.
- [ ] `backend/` and `frontend/` remain safe for future publication into a separate public repository.
- [ ] Any prototype touching auth, access requests, password reset, notifications, tenant boundaries, automation, payments, or deployment is explicitly labeled prototype-local until certified.

## Markdown Health

- [ ] New or changed markdown has a clear purpose.
- [ ] Normal markdown links resolve.
- [ ] Obsidian wiki links resolve.
- [ ] Durable decisions from notes were promoted into tracked docs when needed.
- [ ] Any "later", future, Pre-V16, V16, or VInfinite decision from the conversation is recorded in the proper durable doc or roadmap section.

## Proof Selector

- [ ] Backend behavior changed: run backend tests and add focused tests when behavior changed.
- [ ] Frontend behavior changed: run lint, build, Vitest, and Playwright when routed workflows changed.
- [ ] Database changed: prove Flyway migrations from an empty database.
- [ ] Scripts changed: parse scripts and update script documentation.
- [ ] Documentation changed: keep `README.md`, `docs/index.md`, and affected docs aligned.
- [ ] Deferred decision made: record it in the affected architecture doc, roadmap phase, or VInfinite backlog.
- [ ] Markdown or notes changed: run `.\scripts\quality\markdown-check.ps1`.
- [ ] Publication-facing boundaries changed: run public-readiness and review the `backend/` and `frontend/` boundary.

## Coherence Gap Check

- [ ] Code behavior, database migrations, tests, scripts, generated reports, tracked docs, private notes, and roadmap claims describe the same current system.
- [ ] New or changed behavior has tests at the right layer and proof that it works with surrounding flows.
- [ ] Scripts still verify the app as documented, and docs still name the scripts that matter.
- [ ] Generated reports and screenshots are referenced accurately and do not become stale proof for changed behavior.
- [ ] Any contradiction names the conflicting source of truth, owner version, next action, and proof needed to close it.

## Completion Note

Record:

- QC rule that shaped the work:
- Proof command:
- Result:
- Remaining gap, if any:
