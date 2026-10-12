import { kody, packageStorage } from 'kody:runtime';
import { onRelease } from './on-release.ts';
import type { Tracker } from './contracts.ts';
import { createTracker } from './tracker.ts';
export function runtimeTracker(): Tracker {
    const storage = packageStorage();
    const get = storage.get?.bind(storage);
    const set = storage.set?.bind(storage);
    if (!get || !set)
        throw new Error('packageStorage get and set are required');
    return createTracker({
        storage: {
            get: (key) => get(key),
            set: (key, value) => set(key, value),
        },
        fetch,
        hook: onRelease,
        emailSend: (mail) => kody.emailSend(mail),
    });
}
