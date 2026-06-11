# MerHouse Documentation

This directory is the public-readable documentation layer for the current MerHouse codebase. Keep private deployment values, proof credentials, provider logs, APKs, keystores, and local working notes outside tracked docs.

## Start Here

- [Root README](../README.md): product summary, local setup, common commands, and runtime configuration.
- [Roadmap](architecture/roadmap.md): phase ownership, QC rules, and future-work policy.
- [Development docs](development/development-docs.md): backend, frontend, scripts, and documentation maintenance.
- [Architecture docs](architecture/architecture-docs.md): product and system design notes.
- [Quality docs](quality/quality-docs.md): local certification, live evidence, and cross-surface proof.
- [Operations docs](operations/operations-docs.md): V17 deployment activation and external service proof.

MerHouse is prepared here as a local-development stack and public-readable project. V16.2 local certification is complete through mocks, dry-run proof, cross-surface V&V/QC/QA evidence, repository checks, and a recorded final live browser/installed-APK walkthrough. Private V17 deployment work targets Neon PostgreSQL, a Hugging Face Docker Space backend, a Vercel React/Vite frontend, GitHub Release APK distribution, opt-in SMTP email delivery attempts, signed internal Android release checks, and live web/Android proof before any production claim.

## Documentation Lanes

| Lane | Owns | Does not own |
| --- | --- | --- |
| [Development](development/development-docs.md) | Local setup, backend/frontend guides, script usage, and doc maintenance. | Product architecture decisions or deployment claims. |
| [Architecture](architecture/architecture-docs.md) | Current product behavior, domain boundaries, diagrams, and roadmap truth. | Proof ledgers or provider rollout steps. |
| [Quality](quality/quality-docs.md) | Local certification, cross-surface evidence, live walkthrough expectations, and proof contracts. | Runtime secrets, screenshots, generated reports, or provider logs. |
| [Operations](operations/operations-docs.md) | V17 deployment lane, external service activation, APK release proof, and cutover evidence rules. | Local-only development setup or speculative hosting lanes. |

## Working Notes

Durable project truth belongs in tracked documentation. When local working notes produce lasting decisions, promote those decisions into `README.md`, this docs index, the roadmap, or the affected lane document.
