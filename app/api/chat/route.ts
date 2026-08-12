import { jsonInit, proxy } from "@/lib/backend";

export async function POST(request: Request) {
  const body = await request.text();
  return proxy(request, "/api/chat", jsonInit("POST", JSON.parse(body || "{}")));
}
