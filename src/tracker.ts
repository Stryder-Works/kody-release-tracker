import { KODY_REPO } from './kody-repo.ts';
import type { Release } from './release.ts';
import {
    configSchema,
    defaultConfig,
    configureSchema,
    checkSchema,
    cursorSchema,
    releasePageSchema,
    validate,
} from './contracts.ts';
import type {
    Config,
    Cursor,
    Dependencies,
    Tracker,
    CheckResult,
    Status,
    GithubRelease,
    Timer,
} from './contracts.ts';
const compare = (
    a: Pick<Cursor, 'id' | 'publishedAt'>,
    b: Pick<Cursor, 'id' | 'publishedAt'>,
): number =>
    ((a.publishedAt ?? '') > (b.publishedAt ?? '')
        ? 1
        : (a.publishedAt ?? '') < (b.publishedAt ?? '')
          ? -1
          : 0) || (a.id ?? -1) - (b.id ?? -1);
export function createTracker(deps: Dependencies): Tracker {
    const now = deps.now ?? Date.now;
    const timer: Timer =
        deps.timer ??
        ((milliseconds, callback) => {
            const handle = setTimeout(callback, milliseconds);
            return () => clearTimeout(handle);
        });
    const tracker: Tracker = {
        async job(): Promise<void> {
            const result = await tracker.check();
            const errors: string[] = [];
            if (result.status !== 'ok') errors.push(result.status);
            if (result.error)
                errors.push(
                    result.error +
                        (result.failedRelease
                            ? ` (${result.failedRelease.tag}: ${result.failedRelease.message})`
                            : ''),
                );
            if (result.emailError) errors.push('digest (email_failed)');
            if (errors.length)
                throw new Error(
                    `kody-release-tracker run had errors: ${errors.join(', ')}`,
                );
        },
        async configure(input: unknown = {}): Promise<Config> {
            const changes = validate({ schema: configureSchema, input, field: 'configure input' });
            const current = validate({
                schema: configSchema,
                input: (await deps.storage.get('config')) ?? defaultConfig,
                field: 'stored config',
            });
            const config: Config = {
                email: changes.email ?? current.email,
                tokenSecretName: changes.tokenSecretName === undefined
                    ? current.tokenSecretName
                    : changes.tokenSecretName,
            };
            await deps.storage.set('config', config);
            return config;
        },
        async status(): Promise<Status> {
            const config = validate({
                schema: configSchema,
                input: (await deps.storage.get('config')) ?? defaultConfig,
                field: 'stored config',
            });
            const cursor = validate({
                schema: cursorSchema.nullable(),
                input: (await deps.storage.get('cursor')) ?? null,
                field: 'stored cursor',
            });
            return { config, cursor };
        },
        async check(input: unknown = {}): Promise<CheckResult> {
            const options = validate({ schema: checkSchema, input: input, field: 'check input' });
            const startedAt = now();
            const { config, cursor } = await tracker.status();
            const result: CheckResult = {
                status: 'ok',
                dryRun: options.dryRun,
                repo: KODY_REPO,
                baseline: !cursor,
                notModified: false,
                newReleases: [],
                handled: 0,
                deferred: 0,
                truncated: false,
                error: null,
                failedRelease: null,
                emailed: false,
                emailError: null,
                rateLimitResetAt: null,
            };
            const headers: Record<string, string> = {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'kody-release-tracker',
            };
            if (config.tokenSecretName)
                headers.Authorization = `Bearer {{secret:${config.tokenSecretName}|scope=user}}`;
            if (cursor?.etag) headers['If-None-Match'] = cursor.etag;
            let response: Response;
            try {
                response = await deps.fetch(
                    new URL(
                        `/repos/${KODY_REPO}/releases?per_page=30`,
                        'https://api.github.com',
                    ),
                    {
                        method: 'GET',
                        headers,
                        signal: AbortSignal.timeout(10000),
                    },
                );
            } catch (error) {
                result.error =
                    error instanceof Error &&
                    ['TimeoutError', 'AbortError'].includes(error.name)
                        ? 'timeout'
                        : 'network';
                return result;
            }
            if (response.status === 401 && config.tokenSecretName) {
                result.status = 'token_rejected';
                return result;
            }
            if (
                response.status === 429 ||
                (response.status === 403 &&
                    (response.headers.get('x-ratelimit-remaining') === '0' ||
                        response.headers.has('retry-after')))
            ) {
                result.status = 'rate_limited';
                const reset = response.headers.get('x-ratelimit-reset');
                const retry = response.headers.get('retry-after');
                const timestamp =
                    reset === null
                        ? retry === null
                            ? null
                            : now() + Number(retry) * 1000
                        : Number(reset) * 1000;
                if (timestamp !== null && Number.isFinite(timestamp))
                    result.rateLimitResetAt = new Date(timestamp).toISOString();
                return result;
            }
            if (response.status !== 200 && response.status !== 304) {
                result.error = `http_${response.status}`;
                return result;
            }
            if (response.status === 304) {
                result.notModified = true;
                return result;
            }
            let page: GithubRelease[];
            try {
                const body = await response.json();
                page = validate({ schema: releasePageSchema, input: body, field: 'release response' });
            } catch (error) {
                result.error =
                    error instanceof Error &&
                    ['TimeoutError', 'AbortError'].includes(error.name)
                        ? 'timeout'
                        : 'network';
                return result;
            }
            const kept: Release[] = page
                .flatMap((item) =>
                    item.draft || item.prerelease || item.published_at === null
                        ? []
                        : [
                              {
                                  id: item.id,
                                  tag: item.tag_name,
                                  name: item.name || item.tag_name,
                                  url: item.html_url,
                                  publishedAt: item.published_at,
                                  body: item.body ?? '',
                              },
                          ],
                )
                .sort(compare);
            if (!cursor && !result.dryRun)
                await deps.storage.set('cursor', {
                    id: kept.at(-1)?.id ?? null,
                    publishedAt: kept.at(-1)?.publishedAt ?? null,
                    etag: response.headers.get('etag'),
                    baselineAt: new Date(now()).toISOString(),
                });
            if (cursor) {
                const fresh = kept.filter((item) => compare(item, cursor) > 0);
                result.newReleases = fresh.map(({ id, tag, publishedAt }) => ({
                    id,
                    tag,
                    publishedAt,
                }));
                result.truncated =
                    page.length === 30 &&
                    kept.length > 0 &&
                    fresh.length === kept.length;
                if (result.dryRun) return result;
                const delivered: Release[] = [];
                for (const item of fresh) {
                    if (now() - startedAt >= 50000) {
                        result.deferred = fresh.length - delivered.length;
                        break;
                    }
                    let cancel: () => void = () => {};
                    const timedOut = Symbol('hook timeout');
                    try {
                        const deadline = new Promise<symbol>((resolve) => {
                            cancel = timer(20000, () => resolve(timedOut));
                        });
                        const outcome = await Promise.race([
                            Promise.resolve().then(() => deps.hook(item)),
                            deadline,
                        ]);
                        if (outcome === timedOut) {
                            result.error = 'on_release_timeout';
                            result.failedRelease = {
                                id: item.id,
                                tag: item.tag,
                                message: 'timed out after 20000 ms',
                            };
                            break;
                        }
                        delivered.push(item);
                    } catch (error) {
                        result.error = 'on_release_failed';
                        result.failedRelease = {
                            id: item.id,
                            tag: item.tag,
                            message: Array.from(
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                            )
                                .slice(0, 200)
                                .join(''),
                        };
                        break;
                    } finally {
                        cancel();
                    }
                }
                result.handled = delivered.length;
                const stored = validate({
                    schema: cursorSchema,
                    input: (await deps.storage.get('cursor')) ?? cursor,
                    field: 'stored cursor',
                });
                const last = delivered.at(-1) ?? stored;
                if (compare(stored, last) <= 0) {
                    const next = {
                        id: last.id,
                        publishedAt: last.publishedAt,
                        etag:
                            delivered.length === fresh.length
                                ? response.headers.get('etag')
                                : stored.etag,
                        baselineAt: stored.baselineAt,
                    };
                    if (
                        next.id !== stored.id ||
                        next.publishedAt !== stored.publishedAt ||
                        next.etag !== stored.etag ||
                        next.baselineAt !== stored.baselineAt
                    )
                        await deps.storage.set('cursor', next);
                }
                if (config.email && delivered.length) {
                    const escapes: Record<string, string> = {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;',
                    };
                    const escape = (value: string): string =>
                        value.replace(
                            /[&<>"']/g,
                            (char) => escapes[char] ?? char,
                        );
                    const lines = delivered.slice(0, 50).map((item) => {
                        const name = Array.from(item.name)
                            .slice(0, 200)
                            .join('');
                        return {
                            text: `${KODY_REPO} ${item.tag} ${name} - ${item.url} - ${item.publishedAt}`,
                            html: `${escape(KODY_REPO)} ${escape(item.tag)} ${escape(name)} - <a href="${escape(item.url)}">${escape(item.url)}</a> - ${escape(item.publishedAt)}`,
                        };
                    });
                    if (delivered.length > 50) {
                        const more = `and ${delivered.length - 50} more`;
                        lines.push({ text: more, html: more });
                    }

                    try {
                        await deps.emailSend({
                            subject: `Kody release tracker: ${delivered.length} new release${delivered.length === 1 ? '' : 's'}`,
                            text: lines.map((line) => line.text).join('\n'),
                            html: lines.map((line) => line.html).join('<br>'),
                        });
                        result.emailed = true;
                    } catch {
                        result.emailError = 'email_failed';
                    }
                }
            }
            return result;
        },
    };
    return tracker;
}
