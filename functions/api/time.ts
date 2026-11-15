import { handleTime, type SampleCache } from "../lib/exam-clock-time.ts";
type Context = { request: Request; waitUntil: (p: Promise<unknown>) => void };
export const onRequest = (context: Context): Promise<Response> => {
  const cache = (
    globalThis.caches as (CacheStorage & { default?: SampleCache }) | undefined
  )?.default;
  return handleTime(context.request, {
    // Workers throw "Illegal invocation" when a native function is detached
    // from its global: wrap fetch instead of handing the bare function over.
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    mono: () => performance.now(),
    cache,
    waitUntil: (p) => context.waitUntil(p),
  });
};
