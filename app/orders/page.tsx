"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authHeaders, clearSession, useSession } from "@/lib/auth";
import { STATUS_COLOR, STATUS_LABEL, ORDER_TYPE_LABEL, type Order } from "@/lib/orders";

function parseSse<T>(buffer: string): T[] {
  const events: T[] = [];
  for (const block of buffer.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    const raw = line.slice(6).trim();
    if (!raw) continue;
    try {
      events.push(JSON.parse(raw) as T);
    } catch {
      /* ignore malformed chunk */
    }
  }
  return events;
}

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function upsertOrders(list: Order[], incoming: Order): Order[] {
  if (incoming.status === "cancelled") return list.filter((o) => o.id !== incoming.id);
  const rest = list.filter((o) => o.id !== incoming.id);
  return [incoming, ...rest].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useSession();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsActive, setEventsActive] = useState(false);

  useEffect(() => {
    if (user === null) {
      router.replace("/login");
      return;
    }
    if (user.role === "chef") {
      router.replace("/chef");
    }
  }, [user, router]);

  // Initial load of the customer's orders.
  useEffect(() => {
    if (!user || user.role === "chef") return;
    fetch("/api/orders/mine", { headers: authHeaders() })
      .then(async (res) => {
        if (res.status === 401) {
          clearSession();
          router.replace("/login");
          return [];
        }
        return res.ok ? ((await res.json()) as Order[]) : [];
      })
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  // Live SSE: keep statuses up to date while this page is open.
  useEffect(() => {
    if (!user || user.role === "chef") return;
    const controller = new AbortController();
    let cancelled = false;
    const stream = async () => {
      try {
        const res = await fetch("/api/events", {
          headers: { ...authHeaders(), Accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        setEventsActive(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = parseSse<{ type: string; order?: Order }>(buffer);
          for (const ev of events) {
            if (ev.type === "order_status" && ev.order) {
              setOrders((prev) => upsertOrders(prev, ev.order as Order));
            }
          }
          const lastBoundary = buffer.lastIndexOf("\n\n");
          if (lastBoundary >= 0) buffer = buffer.slice(lastBoundary + 2);
        }
      } catch {
        /* stream dropped; the list stays as-is */
      } finally {
        setEventsActive(false);
      }
    };
    void stream();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  if (!user) return null;

  return (
    <div className="flex h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <Image
          src="/dineflow-logo.png"
          alt="Dineflow logo"
          width={36}
          height={36}
          className="h-9 w-9 rounded-xl object-contain"
          priority
        />
        <div className="flex-1">
          <h1 className="text-base font-semibold leading-tight">My orders</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {user.name ? `${user.name} · ` : ""}
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </p>
        </div>
        <span
          className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-[11px] sm:flex ${
            eventsActive
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${eventsActive ? "animate-pulse bg-emerald-500" : "bg-zinc-400"}`}
          />
          {eventsActive ? "Live" : "Offline"}
        </span>
        <Link
          href="/"
          className="rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-sm font-medium text-orange-600 transition hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60"
        >
          Chat
        </Link>
        <button
          onClick={logout}
          className="rounded-full px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          Log out
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">
          {loading ? (
            <p className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-zinc-400 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              Loading your orders…
            </p>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <p className="text-sm text-zinc-400">You haven’t placed any orders yet.</p>
              <Link
                href="/"
                className="mt-3 inline-block rounded-full bg-orange-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
              >
                Order something
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-700">
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                    >
                      <td className="px-4 py-3 font-medium">#{o.id}</td>
                      <td className="max-w-xs px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {ORDER_TYPE_LABEL[o.order_type]}
                          </span>
                          {o.order_type === "delivery" && o.delivery_address && (
                            <span className="max-w-44 text-xs text-zinc-500 dark:text-zinc-400">
                              {o.delivery_address}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">${o.total.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_COLOR[o.status]}`}
                        >
                          {STATUS_LABEL[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                        {fmtWhen(o.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
