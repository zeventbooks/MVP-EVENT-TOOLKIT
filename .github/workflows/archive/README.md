# Archived GitHub Workflows

This folder contains legacy CI workflows that are no longer part of the active CI/CD pipeline.

Rules:
- Only `stage1.yml`, `stage2.yml` (and at most one security scan workflow) should live in `.github/workflows/`.
- All other historical workflows must be moved into this `archive/` directory with their original filenames.
- Do **not** edit archived workflows except to add a deprecation comment at the top.
