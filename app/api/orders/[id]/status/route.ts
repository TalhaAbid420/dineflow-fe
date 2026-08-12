import { jsonInit, proxy } from "@/lib/backend";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/orders/[id]/status">,
) {
  const { id } = await ctx.params;
  const body = await request.text();
  return proxy(
    request,
    `/api/orders/${id}/status`,
    jsonInit("PATCH", JSON.parse(body || "{}")),
  );
}
