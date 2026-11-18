import { handleTimeSync, type SampleCache } from "../lib/time-sync.ts";
type Context = { request: Request; waitUntil: (p: Promise<unknown>) => void };
export const onRequest = (context: Context): Promise<Response> =>
  handleTimeSync(context.request, {
    fetch: (input, init) => globalThis.fetch(input, init),
    now: () => Date.now(),
    mono: () => performance.now(),
    cache: (
      globalThis.caches as
        (CacheStorage & { default?: SampleCache }) | undefined
    )?.default,
    waitUntil: (p) => context.waitUntil(p),
  });
