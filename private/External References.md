# External References

This private workspace can track notes and references that should never be copied into the future public app repository.

Publication boundary:

- `backend/`
- `frontend/`

Anything private or sensitive belongs outside those folders and should be referenced from app code, docs, scripts, or notes by path, environment variable, or template.

Use this file to record private reference locations, operational notes, vendor/account pointers, and other non-public project context.

## Sensitive Material

Use external references for:

- API keys and organization/project identifiers
- vendor tokens and account IDs
- payment, carrier, email, cloud, analytics, and AI provider credentials
- prompts containing private business context
- customer or partner data
- internal endpoints, deployment details, and operational runbooks
- production credentials and secret-management notes
- generated proof reports that include sensitive operational details

App code should consume those values through environment variables or explicit external file paths, never hard-coded literals or checked-in files under `backend/` or `frontend/`.

## References

- Obsidian dashboard: [[.notes/00 Dashboard]]
- Roadmap QC checklist: [[.notes/QC/Roadmap QC Checklist]]
- Knowledge system: [[docs/development/knowledge-system]]
