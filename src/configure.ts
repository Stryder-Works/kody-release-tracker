import type { ConfigureInput, Config } from './contracts.ts';
import { runtimeTracker } from './runtime.ts';
/**
 * Update digest or token settings without resetting omitted settings.
 * New forks default to email false and no token. An empty call preserves settings.
 * @param input Optional email boolean and tokenSecretName string or null.
 * tokenSecretName names your Kody user secret for a GitHub token, not the token value.
 * The optional token raises the rate limit for public release reads; no token is required.
 * Secret names use 1–64 letters, digits, dots, underscores, or hyphens.
 * Use tokenSecretName null to clear the token. Unknown keys are rejected.
 * @returns The complete stored configuration, with the secret name only.
 * @example
 * import configure from 'kody:@scope/kody-release-tracker/configure'
 * await configure({ email: true, tokenSecretName: 'release-token' })
 */
export default async function configure(
    input: ConfigureInput = {},
): Promise<Config> {
    return runtimeTracker().configure(input);
}
