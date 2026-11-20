// TEMPORARY diagnostic: which status codes survive the zone's error-page handling.
export const onRequest = async (context: { request: Request }) => {
  const url = new URL(context.request.url);
  const status = Number(url.searchParams.get("status") || "200");
  return new Response(JSON.stringify({ seen: status }), {
    status: Number.isSafeInteger(status) && status >= 200 && status <= 599 ? status : 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
};
