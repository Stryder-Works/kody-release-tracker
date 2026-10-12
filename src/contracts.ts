import { z } from 'zod';
import type { Release } from './release.ts';

const secretNameSchema = z
    .string()
    .regex(/^[a-zA-Z0-9._-]{1,64}$/, 'must match ^[a-zA-Z0-9._-]{1,64}$');
export const configSchema = z.strictObject({
    email: z.boolean(),
    tokenSecretName: secretNameSchema.nullable(),
});
export const configureSchema = configSchema.partial();
export const defaultConfig: Config = { email: false, tokenSecretName: null };
export const checkSchema = z.strictObject({
    dryRun: z.boolean().default(false),
});
export const cursorSchema = z
    .strictObject({
        id: z.number().int().nonnegative().nullable(),
        publishedAt: z.iso.datetime().nullable(),
        etag: z.string().nullable(),
        baselineAt: z.iso.datetime(),
    })
    .refine((value) => (value.id === null) === (value.publishedAt === null), {
        message: 'id and publishedAt must both be null or both be set',
        path: ['publishedAt'],
    });
export const githubReleaseSchema = z.object({
    id: z.number().int().nonnegative(),
    tag_name: z.string(),
    name: z.string().nullable(),
    html_url: z.httpUrl(),
    published_at: z.iso.datetime().nullable(),
    body: z.string().nullable(),
    draft: z.boolean(),
    prerelease: z.boolean(),
});
export const releasePageSchema = z.array(githubReleaseSchema);
export type Config = z.infer<typeof configSchema>;
export type ConfigureInput = z.input<typeof configureSchema>;
export type CheckInput = z.input<typeof checkSchema>;
export type Cursor = z.infer<typeof cursorSchema>;
export type GithubRelease = z.infer<typeof githubReleaseSchema>;
export type Mail = { subject: string; text: string; html: string };
export type StorageKey = 'config' | 'cursor';
export type Storage = {
    get: (key: StorageKey) => Promise<unknown>;
    set: (key: StorageKey, value: Config | Cursor) => Promise<unknown>;
};
export type Timer = (milliseconds: number, callback: () => void) => () => void;
export type Dependencies = {
    storage: Storage;
    fetch: typeof fetch;
    hook: (release: Release) => Promise<void>;
    emailSend: (mail: Mail) => Promise<unknown>;
    now?: () => number;
    timer?: Timer;
};
export type CheckError =
    | `http_${number}`
    | 'timeout'
    | 'network'
    | 'on_release_failed'
    | 'on_release_timeout';
export type CheckResult = {
    status: 'ok' | 'rate_limited' | 'token_rejected';
    dryRun: boolean;
    repo: string;
    baseline: boolean;
    notModified: boolean;
    newReleases: Array<Pick<Release, 'id' | 'tag' | 'publishedAt'>>;
    handled: number;
    deferred: number;
    truncated: boolean;
    error: CheckError | null;
    failedRelease: { id: number; tag: string; message: string } | null;
    emailed: boolean;
    emailError: 'email_failed' | null;
    rateLimitResetAt: string | null;
};
export type Status = { config: Config; cursor: Cursor | null };
export type Tracker = {
    configure: (input?: unknown) => Promise<Config>;
    check: (input?: unknown) => Promise<CheckResult>;
    status: () => Promise<Status>;
    job: () => Promise<void>;
};

export function validate<S extends z.ZodType>(
    { schema, input, field }: { schema: S; input: unknown; field: string },
): z.output<S> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new Error(`${field}: ${parsed.error.message}`);
    return parsed.data;
}
