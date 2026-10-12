import type { Status } from './contracts.ts';
import { runtimeTracker } from './runtime.ts';
/**
 * Inspect this fork's settings and baseline before a check or schedule change.
 * @returns Config and cursor; cursor is null before the first live run.
 * Includes only the token secret name, never its value or a secret placeholder.
 * @example
 * import status from 'kody:@scope/kody-release-tracker/status'
 * await status()
 */
export default async function status(): Promise<Status> {
    return runtimeTracker().status();
}
