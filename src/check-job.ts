import { runtimeTracker } from './runtime.ts';
/**
 * Run the exact no-argument job entry before you enable its schedule.
 * The first run writes a baseline without hooks or email. Later runs deliver releases.
 * Reads the fork's stored configuration. This is a live call, with no dry-run mode.
 * @returns Resolves on success; throws on request, hook, or digest failure.
 * @example
 * import checkJob from 'kody:@scope/kody-release-tracker/check-job'
 * await checkJob()
 */
export default async function checkJob(): Promise<void> {
    await runtimeTracker().job();
}
