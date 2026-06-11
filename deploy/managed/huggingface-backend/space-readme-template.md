---
title: MerHouse Backend
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---

# MerHouse Backend Space

This directory is the public, secret-free template for the V17 Hugging Face Docker Space backend.

Create a Docker Space, then copy this template as `README.md` alongside `Dockerfile` and the repository `backend/` directory in the Space repository. Runtime values must be entered through the Space Settings page as variables or secrets; do not commit deployment values here or in the Space repository.

Use the Space URL as the API base URL:

```text
https://<owner>-<space-name>.hf.space
```

The backend serves health at:

```text
https://<owner>-<space-name>.hf.space/api/v1/health
```
