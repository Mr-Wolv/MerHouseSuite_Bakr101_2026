# Operations Docs

Operations docs own the V17 deployment and release activation path. They describe provider choices, external service proof, cutover requirements, and what remains private until real deployment evidence exists.

- [Production deployment activation](production-deployment-activation.md)
- [V17 external service activation](v17-service-activation.md)

Current V17 direction is Neon PostgreSQL, Hugging Face Docker Space backend, Firebase Hosting frontend, and GitHub Release APK distribution. VPS/Compose, Cloud Run, Oracle Cloud Always Free, and sponsored hosting are VInfinite candidates unless the roadmap deliberately reopens them.
