// Server-only helper for Next.js route handlers that proxy to the FastAPI backend.
// Never import this from a client component.

export function backendBase(): string {
  return (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

export async function proxy(
  request: Request,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  const res = await fetch(`${backendBase()}${path}`, { ...init, headers });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

export function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}
