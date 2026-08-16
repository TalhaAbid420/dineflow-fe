"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authHeaders, clearSession, useSession } from "@/lib/auth";
import {
  STATUS_DOT,
  STATUS_FLOW as FLOW,
  STATUS_LABEL,
  ORDER_TYPE_LABEL,
  type Order,
  type OrderStatus,
} from "@/lib/orders";

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

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function upsertOrders(list: Order[], incoming: Order): Order[] {
  if (incoming.status === "cancelled") return list.filter((o) => o.id !== incoming.id);
  const rest = list.filter((o) => o.id !== incoming.id);
  return [incoming, ...rest].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export default function ChefPage() {
  const router = useRouter();
  const { user } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [eventsActive, setEventsActive] = useState(false);
  const updatingRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "chef") {
      router.replace("/");
    }
  }, [user, router]);

  // Initial load of every order.
  useEffect(() => {
    if (!user || user.role !== "chef") return;
    fetch("/api/orders", { headers: authHeaders() })
      .then((res) => {
        if (res.status === 401) {
          clearSession();
          router.replace("/login");
          throw new Error("unauthorized");
        }
        return res.ok ? res.json() : [];
      })
      .then((data: Order[]) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user, router]);

  // Live SSE: broadcast channel gives the chef every order update.
  useEffect(() => {
    if (!user || user.role !== "chef") return;
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

  async function advance(orderId: number, next: OrderStatus) {
    if (updatingRef.current.has(orderId)) return;
    updatingRef.current.add(orderId);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: next }),
      });
      if (res.status === 401) {
        clearSession();
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        setError(data?.detail ?? "Could not update the order.");
        return;
      }
      const updated = (await res.json()) as Order;
      setOrders((prev) => upsertOrders(prev, updated));
    } catch {
      setError("Could not reach the server.");
    } finally {
      updatingRef.current.delete(orderId);
    }
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  if (!user) return null;

  const summary: Record<OrderStatus, number> = {
    pending: orders.filter((o) => o.status === "pending").length,
    baking: orders.filter((o) => o.status === "baking").length,
    baked: orders.filter((o) => o.status === "baked").length,
    "in-delivery": orders.filter((o) => o.status === "in-delivery").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

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
          <h1 className="text-base font-semibold leading-tight">Kitchen dashboard</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Signed in as chef · {orders.length} order{orders.length === 1 ? "" : "s"}
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
        <button
          onClick={logout}
          className="rounded-full px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          Log out
        </button>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        {FLOW.map((s) => (
          <span
            key={s}
            className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
            {STATUS_LABEL[s]}: {summary[s]}
          </span>
        ))}
      </div>

      {error && (
        <p className="border-b border-zinc-200 bg-red-50 px-6 py-2 text-xs text-red-600 dark:border-zinc-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">
          {orders.length === 0 ? (
            <p className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-zinc-400 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              No orders yet. They will appear here as customers place them.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((o) => {
                const idx = FLOW.indexOf(o.status);
                const isCancelled = o.status === "cancelled";
                const next: OrderStatus | null = isCancelled ? null : FLOW[idx + 1] ?? null;
                return (
                  <div
                    key={o.id}
                    className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[o.status]}`}
                        />
                        <div>
                          <p className="text-sm font-semibold">
                            Order #{o.id}
                            {o.customer_name ? ` · ${o.customer_name}` : ""}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {o.user_email ?? o.user_name ?? "Guest"} · {fmtTime(o.created_at)}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                o.order_type === "delivery"
                                  ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              }`}
                            >
                              {ORDER_TYPE_LABEL[o.order_type]}
                            </span>
                            {o.order_type === "delivery" && o.delivery_address && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {o.delivery_address}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {STATUS_LABEL[o.status]}
                        </span>
                        {next && (
                          <button
                            onClick={() => void advance(o.id, next)}
                            className="rounded-full bg-orange-500 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
                          >
                            Mark {STATUS_LABEL[next].toLowerCase()} →
                          </button>
                        )}
                        {!next && (
                          <span
                            className={`text-xs font-medium ${
                              isCancelled
                                ? "text-red-600 dark:text-red-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {isCancelled ? "Cancelled" : "Delivered"}
                          </span>
                        )}
                      </div>
                    </div>
                    <ul className="mt-3 flex flex-col gap-1 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
                      {o.items.map((item, i) => (
                        <li key={i} className="flex justify-between text-zinc-600 dark:text-zinc-300">
                          <span>
                            {item.quantity}× {item.name}
                          </span>
                          <span className="tabular-nums">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </li>
                      ))}
                      <li className="flex justify-between pt-1 font-semibold">
                        <span>Total</span>
                        <span className="tabular-nums">${o.total.toFixed(2)}</span>
                      </li>
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
