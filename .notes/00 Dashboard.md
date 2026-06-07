# MerHouse Dashboard

## Start Here

- [[README|README]]
- [[docs/index|Documentation index]]
- [[docs/architecture/roadmap|Roadmap and QC rules]]
- [[docs/development/knowledge-system|Knowledge system]]
- [[AGENTS|Agent guidance]]
- [[private/External References|Private external references]]

## Current Work

- [[.notes/Daily/2026-05-31|Today]]
- [[.notes/QC/Roadmap QC Checklist|Roadmap QC checklist]]
- [[.notes/QC/Final Public Repo Closeout|Final public repo closeout]]
- [[.notes/Inbox/README|Inbox]]

## Work Notes

- Feature notes: `.notes/Features`
- Bug notes: `.notes/Bugs`
- Architecture notes: `.notes/Architecture`
- Decision notes: `.notes/Decisions`
- Templates: [[.notes/Templates/Feature Note|Feature]], [[.notes/Templates/Bug Note|Bug]], [[.notes/Templates/Architecture Map|Architecture]], [[.notes/Templates/Decision Record|Decision]], [[.notes/Templates/Daily Note|Daily]]

## Operating Rule

These notes are a private thinking layer. Durable project truth belongs in tracked source: `README.md`, `docs/index.md`, `docs/architecture/roadmap.md`, and affected files under `docs/`.

When a note becomes durable knowledge, promote the cleaned version into tracked documentation and run the matching roadmap proof.

Future publication boundary: `backend/` and `frontend/` in a separate public repository. Anything private should live outside those folders and be referenced by path, environment variable, or template.

Markdown proof:

```powershell
.\scripts\quality\markdown-check.ps1
```
