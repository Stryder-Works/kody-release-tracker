# Changelog

## [Unreleased]

- `configure` now preserves omitted settings. To reset both settings, pass `{ email: false, tokenSecretName: null }`.
- Export `check-job` so a fork can verify the exact scheduled entry before activation.
- Add installation and selective-update runbooks. Preserve fork identity, dependencies, schedule, and custom code during upstream updates.
- Permit public source links and dependency scopes in the publication scan. Retain secret, private-path, and email checks.

The release object remains version 1. Existing hook code needs no signature change.
