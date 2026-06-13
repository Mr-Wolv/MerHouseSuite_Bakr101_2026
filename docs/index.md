# MerHouse Documentation

This directory is the public-readable documentation layer for the current MerHouse codebase. Keep private deployment values, proof credentials, provider logs, APKs, keystores, and local working notes outside tracked docs.

## Start Here

- [Root README](../README.md): product summary, local setup, common commands, and runtime configuration.
- [Roadmap](architecture/roadmap.md): phase ownership, QC rules, and future-work policy.
- [Development docs](development/development-docs.md): backend, frontend, scripts, and documentation maintenance.
- [Architecture docs](architecture/architecture-docs.md): product and system design notes.
- [Quality docs](quality/quality-docs.md): local certification, live evidence, and cross-surface proof.
- [Operations docs](operations/operations-docs.md): V17 deployment activation, managed deployment proof, and external service proof.

MerHouse is prepared here as a public-readable project with a reproducible local development stack and a **confirmed live** private V17 deployed lane. V16.2 local certification is complete through mocks, dry-run proof, cross-surface V&V/QC/QA evidence, repository checks, and a recorded final live browser/installed-APK walkthrough. V17 deployment is now confirmed live on Neon PostgreSQL, Hugging Face Docker Space backend, Vercel React/Vite frontend, GitHub Actions CI/CD, and GitHub Release APK distribution. The remaining V17 work focuses on four portfolio features: Access Request & Approve-and-Activate, OTP Password Recovery, How To Use Page, and AI Assistant Completion with conversation threading. See [`V17-RE-EVALUATION.md`](refactor/V17-RE-EVALUATION.md) for the full scope.

## Documentation Lanes

| Lane | Owns | Does not own |
| --- | --- | --- |
| [Development](development/development-docs.md) | Local setup, backend/frontend guides, script usage, and doc maintenance. | Product architecture decisions or deployment claims. |
| [Architecture](architecture/architecture-docs.md) | Current product behavior, domain boundaries, diagrams, and roadmap truth. | Proof ledgers or provider rollout steps. |
| [Quality](quality/quality-docs.md) | Local certification, cross-surface evidence, live walkthrough expectations, and proof contracts. | Runtime secrets, screenshots, generated reports, or provider logs. |
| [Operations](operations/operations-docs.md) | V17 deployed lane, external service activation, APK release proof, and cutover evidence rules. | Routine local development setup or speculative hosting lanes. |

## Working Notes

Durable project truth belongs in tracked documentation. When local working notes produce lasting decisions, promote those decisions into `README.md`, this docs index, the roadmap, or the affected lane document.
