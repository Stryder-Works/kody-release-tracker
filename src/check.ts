import type { CheckInput, CheckResult } from './contracts.ts';
import { runtimeTracker } from './runtime.ts';
/**
 * Preview releases and auth with dryRun before a live release check.
 * The first live run records a baseline without delivery. Later live runs call the hook
 * and may send a digest. Repeated release IDs are possible after a failure or timeout.
 * @param input Optional dryRun boolean (default false). Unknown keys are rejected.
 * With dryRun true, fetch releases but skip hooks, email, and storage writes.
 * @returns Baseline, pending releases, delivery counts, and request/hook/email errors.
 * @example
 * import check from 'kody:@scope/kody-release-tracker/check'
 * await check({ dryRun: true })
 */
export default async function check(
    input: CheckInput = {},
): Promise<CheckResult> {
    return runtimeTracker().check(input);
}
