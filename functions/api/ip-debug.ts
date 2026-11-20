// TEMPORARY diagnostic endpoint: reproduce the lookup path in production and
// report each step. Removed immediately after the root cause is found.
const target = (ip: string) => ({
  name: "ipwho.is",
  url: `https://ipwho.is/${encodeURIComponent(ip)}`,
});

export const onRequest = async (context: { request: Request }) => {
  const steps: unknown[] = [];
  const ip = new URL(context.request.url).searchParams.get("ip") || "8.8.8.8";
  try {
    steps.push({ step: "start", ip });
    const t = target(ip);
    steps.push({ step: "url", url: t.url });
    const started = Date.now();
    const response = await fetch(t.url, {
      headers: { Accept: "application/json" },
      redirect: "manual",
    });
    steps.push({
      step: "fetch",
      status: response.status,
      ms: Date.now() - started,
    });
    const text = await response.text();
    steps.push({ step: "body", length: text.length, head: text.slice(0, 120) });
  } catch (error) {
    steps.push({
      step: "error",
      message: String((error as Error)?.message ?? error),
      stack: String((error as Error)?.stack ?? "").slice(0, 800),
    });
  }
  return new Response(JSON.stringify({ ip, steps }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
