# Install and verify a fork

Follow [README setup](../README.md#setup) for configuration and tracker checks.
For platform fork/publish mechanics, load Kody MCP `search({ entity: "guide:package_lifecycle" })`;
for package requirements, load `search({ entity: "guide:package_authoring" })`.

## Before publishing

Agree on the hook action, email preference, schedule, and timezone. Use the returned fork
identity for all calls. Keep a new job disabled; for an existing fork, record its enabled
state and pause it with `jobUpdate`. Confirm it is disabled—manifest `enabled: false`
does not pause an active job. Save the chosen schedule and timezone in `package.json#kody.jobs`,
keeping `enabled: false` in the distributable manifest. Run package checks before publishing
the adapted source.

## Verify the hook

The README dry run checks release access; the first live run only establishes a baseline.
Neither proves that your customized hook works.

- Test the actual hook with a representative release, an obvious test ID, and mocked external services.
- Repeat the ID to check duplicate handling, and exercise a service failure to check error handling.
- If live verification is needed, agree on a bounded action and inspect its destination afterward. A private fork can temporarily export the hook for this check; remove the export and republish afterward.

Fixture calls bypass the cursor. Avoid real pending release IDs for destructive tests.

## Before activation

Confirm the final published revision matches the reviewed source. Run the README tracker
checks against that revision, and check saved settings and cursor. With an existing baseline,
review pending effects before invoking the live wrapper. Keep the job paused if verification fails.
Before completing setup, confirm the published manifest and live job both match the user's
chosen schedule and timezone. A `jobUpdate` change alone is temporary: publishing reapplies
the manifest. If they differ, correct the manifest and repeat publication and verification
while the job stays paused.

Enable a verified new job separately with `jobUpdate`, or restore an existing job's prior
enabled state. Report the action, digest choice, and verified active schedule to the user.
