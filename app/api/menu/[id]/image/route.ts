import { backendBase } from "@/lib/backend";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/menu/[id]/image">,
) {
  const { id } = await ctx.params;
  const res = await fetch(`${backendBase()}/api/menu/${id}/image`);
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
