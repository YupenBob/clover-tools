// TEMPORARY diagnostic endpoint: run the real lookup handler in production and
// report the thrown error instead of the platform 502 page.
import { onRequest as reputation } from "./ip-reputation.ts";

export const onRequest = async (context: {
  request: Request;
  env: { IPAPI_IS_KEY?: string };
}) => {
  const url = new URL(context.request.url);
  const ip = url.searchParams.get("ip") || "8.8.8.8";
  const report: Record<string, unknown> = { ip };
  try {
    const target = new URL("/api/ip-reputation", url);
    const response = await reputation({
      request: new Request(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", query: ip }),
      }),
      env: context.env ?? {},
    });
    report.status = response.status;
    report.body = (await response.text()).slice(0, 800);
  } catch (error) {
    report.error = {
      name: (error as Error)?.name,
      message: String((error as Error)?.message ?? error),
      stack: String((error as Error)?.stack ?? "").slice(0, 1200),
    };
  }
  return new Response(JSON.stringify(report), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
