import { handleTime, type SampleCache } from "../lib/exam-clock-time.ts";
type Context = { request: Request; waitUntil: (p: Promise<unknown>) => void };
export const onRequest = (context: Context): Promise<Response> => {
  const cache = (
    globalThis.caches as (CacheStorage & { default?: SampleCache }) | undefined
  )?.default;
  return handleTime(context.request, {
    fetch,
    now: () => Date.now(),
    mono: () => performance.now(),
    cache,
    waitUntil: (p) => context.waitUntil(p),
  });
};
