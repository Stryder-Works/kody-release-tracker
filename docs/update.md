# Update a customized fork

For platform update mechanics, load Kody MCP `search({ entity: "guide:package_lifecycle" })`.

1. Review the upstream diff and `CHANGELOG.md`. Record the upstream revision, your fork's published revision, settings, cursor, and job state.
2. Pause the job with `jobUpdate` and confirm it is disabled before publishing changes.
3. Port selected changes. Preserve your fork identity, hook, helpers, dependencies, secret declarations, schedule, timezone, and adapted docs. Merge manifest changes field by field.
4. Run package checks and affected hook tests, then publish. With `repoPublishSession`, set `absorbed_upstream_commit` to the reviewed upstream revision; this records acknowledgement, not a merge. The git publish capability has no equivalent input.
5. [Verify the published tracker and hook](install.md). Confirm settings and cursor persist, and inspect the schedule and timezone before restoring the job's prior enabled state. If verification fails, leave it paused and report the next repair step.

The release object is version 1. Additive fields are compatible; removed or changed fields
need a hook review. Preserve your action if upstream changes its empty hook or examples.
