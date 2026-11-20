// TEMPORARY diagnostic endpoint.
import { onRequest as reputation } from "./ip-reputation.ts";

export const onRequest = async (context: {
  request: Request;
  env: { IPAPI_IS_KEY?: string };
}) => {
  const url = new URL(context.request.url);
  const ip = url.searchParams.get("ip") || "8.8.8.8";
  const report: Record<string, unknown> = { ip };
  const body = JSON.stringify({ action: "lookup", query: ip });
  try {
    const internal = await reputation({
      request: new Request(new URL("/api/ip-reputation", url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
      env: context.env ?? {},
    });
    const text = await internal.text();
    report.internal = { status: internal.status, length: text.length, head: text.slice(0, 200) };
  } catch (error) {
    report.internalError = String((error as Error)?.stack ?? error).slice(0, 600);
  }
  try {
    const external = await fetch(new URL("/api/ip-reputation", url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await external.text();
    report.external = {
      status: external.status,
      contentType: external.headers.get("content-type"),
      length: text.length,
      head: text.slice(0, 120),
    };
  } catch (error) {
    report.externalError = String((error as Error)?.message ?? error).slice(0, 300);
  }
  return new Response(JSON.stringify(report), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
