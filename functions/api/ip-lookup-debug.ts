// TEMPORARY diagnostic: emit the real lookup response under a fresh route so we
// can compare status handling between routes.
import { onRequest as reputation } from "./ip-reputation.ts";

export const onRequest = async (context: {
  request: Request;
  env: { IPAPI_IS_KEY?: string };
}) => {
  const url = new URL(context.request.url);
  const mode = url.searchParams.get("mode") || "same";
  const ip = url.searchParams.get("ip") || "8.8.8.8";
  const inner = await reputation({
    request: new Request(new URL("/api/ip-reputation", url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lookup", query: ip }),
    }),
    env: context.env ?? {},
  });
  const text = await inner.text();
  return new Response(text, {
    status: mode === "200" ? 200 : inner.status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
};
