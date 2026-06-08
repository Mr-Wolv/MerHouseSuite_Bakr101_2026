# Knowledge System

MerHouse uses tracked documentation as the source of truth. The goal is to keep architecture, setup, roadmap scope, and quality rules understandable from the repository itself.

## Source Layers

| Layer | Path | Role |
| --- | --- | --- |
| Durable project truth | `README.md`, `docs/index.md`, `docs/architecture/roadmap.md`, and affected `docs/` pages | Product scope, architecture, roadmap, setup, and quality rules that should stay coherent with the code. |
| Agent operating rules | `AGENTS.md` | Instructions for coding agents working in the repository. |

## Local Notes Policy

Local notes are fine, but they should stay local. If a note turns into a real project decision, move that decision into the tracked docs.

Keep out of Git:

- scratch notes
- machine-specific settings
- generated reports
- local environment files
- deployment-specific run details

Promote durable knowledge into tracked documentation when it changes how the project works, how the code behaves, what the roadmap promises, or what future agents need to know. Durable docs should stand on their own.

## What Belongs In Git

The repository may contain:

- `backend/`
- `frontend/`
- `docs/`
- `scripts/`
- `.github/`
- root configuration and guidance files

Runtime values and deployment-specific settings should come from environment variables, explicit local files, or templates. The repository should stay runnable and understandable without carrying machine-specific context.

## Markdown Quality

Run the markdown proof after changing tracked docs:

```powershell
.\scripts\quality\markdown-check.ps1
```

The check validates normal markdown links and supported wiki-style links for markdown files outside generated dependency and report folders. The broad quality script also runs it:

```powershell
.\scripts\quality\check.ps1
```

## Gap Closure Rule

When notes reveal a contradiction, stale doc, missing proof, or repo-shape risk, close it before moving deeper into implementation. If it cannot be closed immediately, record it in the roadmap or a tracked doc with the owner, risk, and proof needed.
