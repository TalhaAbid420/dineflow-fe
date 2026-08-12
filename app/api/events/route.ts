import { backendBase } from "@/lib/backend";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const headers: Record<string, string> = { Accept: "text/event-stream" };
  if (auth) headers.Authorization = auth;

  const upstream = await fetch(`${backendBase()}/api/events`, { headers });
  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
