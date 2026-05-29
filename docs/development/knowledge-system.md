# Knowledge System

MerHouse uses tracked documentation plus a private Obsidian-friendly note layer. The goal is to keep thinking active without letting private notes become a conflicting source of truth.

## Source Layers

| Layer | Path | Role |
| --- | --- | --- |
| Durable project truth | `README.md`, `docs/index.md`, `docs/architecture/roadmap.md`, and affected `docs/` pages | Product scope, architecture, roadmap, setup, and quality rules that should stay coherent with the code. |
| Agent operating rules | `AGENTS.md` | Instructions for coding agents working in this private repository. |
| Private working notes | `.notes/` | Obsidian dashboard, daily notes, inbox, QC checklists, templates, and exploratory notes. |
| Private references | `private/` | Non-public references, vendor/account pointers, operational notes, and sensitive context that must stay outside `backend/` and `frontend/`. |

## Obsidian Workflow

Open the repository root as the Obsidian vault. The dashboard is `.notes/00 Dashboard.md`.

Use notes for active thinking:

- daily focus and proof notes
- feature discovery and bug triage
- decision drafts
- architecture maps
- QC checklists
- links to private references

Promote durable knowledge into tracked documentation when it changes how the project works, how the code behaves, what the roadmap promises, or what future agents need to know. Notes should point to durable docs; durable docs should not depend on private notes for core understanding.

## Publication Boundary

The future public repository should contain only:

- `backend/`
- `frontend/`

Sensitive or private material must stay outside those folders and be consumed through environment variables, explicit file paths, or templates. This includes secrets, keys, tokens, private prompts, customer data, vendor account details, internal endpoints, generated sensitive reports, and production deployment details.

## Markdown Quality

Run the markdown proof after changing tracked docs or private notes:

```powershell
.\scripts\quality\markdown-check.ps1
```

The check validates normal markdown links and Obsidian wiki links for markdown files outside generated dependency and report folders. The broad quality script also runs it:

```powershell
.\scripts\quality\check.ps1
```

## Gap Closure Rule

When notes reveal a contradiction, stale doc, missing proof, or publication-boundary risk, close it before moving deeper into implementation. If it cannot be closed immediately, record it in the roadmap, a tracked doc, or a current QC note with the owner, risk, and proof needed.
