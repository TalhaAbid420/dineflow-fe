import { proxy } from "@/lib/backend";

export async function GET(request: Request) {
  return proxy(request, "/api/orders");
}
