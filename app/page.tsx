"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authHeaders, clearSession, useSession, type User } from "@/lib/auth";

type Role = "user" | "assistant";

type MenuItem = {
  id: number;
  name: string;
  description?: string;
  price: number;
  category?: string;
  available?: boolean;
  image_url?: string | null;
};

type Message = {
  id: string;
  role: Role;
  content: string;
  tools?: string[];
  menu?: MenuItem[];
  categories?: string[];
};

type StreamEvent =
  | { type: "delta"; content: string }
  | { type: "tool"; name: string; arguments?: string }
  | { type: "menu"; items: MenuItem[] }
  | { type: "menu_categories"; categories: string[] }
  | { type: "done"; content: string }
  | { type: "error"; message: string };

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi, I'm Dineflow. I can show you today's menu, take your order, and check its status. What would you like?",
};

const chatStorageKey = (userId: number) => `dineflow_chat_${userId}`;

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

const CATEGORY_ORDER = ["Starters", "Mains", "Beverages", "Desserts"];

function groupByCategory(items: MenuItem[]): [string, MenuItem[]][] {
  const groups = new Map<string, MenuItem[]>();
  for (const item of items) {
    const cat = item.category?.trim() || "Other";
    groups.set(cat, [...(groups.get(cat) ?? []), item]);
  }
  const known = CATEGORY_ORDER.filter((c) => groups.has(c));
  const rest = [...groups.keys()]
    .filter((c) => !CATEGORY_ORDER.includes(c))
    .sort();
  return [...known, ...rest].map((c) => [c, groups.get(c)!] as [string, MenuItem[]]);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function MenuCart({
  items,
  onPick,
}: {
  items: MenuItem[];
  onPick: (item: MenuItem) => void;
}) {
  const groups = groupByCategory(items);
  return (
    <div className="mb-2 flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
      {groups.map(([category, group]) => (
        <section key={category}>
          <h4 className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {category}
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="tabular-nums">{group.length}</span>
          </h4>
          <div className="flex flex-col gap-2">
            {group.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item)}
                title={`Add ${item.name} to your order`}
                className="group flex w-full items-center gap-3 rounded-2xl bg-zinc-50 p-3 text-left ring-1 ring-zinc-200 transition hover:bg-orange-50 hover:ring-orange-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-60 dark:bg-zinc-800/60 dark:ring-zinc-700 dark:hover:bg-orange-900/20 dark:hover:ring-orange-800"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-700">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      unoptimized
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200 text-xs font-bold text-orange-600 dark:from-orange-900/40 dark:to-orange-900/60 dark:text-orange-300">
                      {initials(item.name)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{item.name}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-orange-600 dark:text-orange-400">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-zinc-500 dark:text-zinc-400">
                      {item.description}
                    </p>
                  )}
                </div>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500 transition group-hover:bg-orange-500 group-hover:text-white dark:bg-zinc-700 dark:text-zinc-300">
                  +
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { user } = useSession();

  useEffect(() => {
    if (user === null) {
      router.replace("/login");
      return;
    }
    if (user.role === "chef") {
      router.replace("/chef");
    }
  }, [user, router]);

  if (!user) return null;

  // Key the chat by user so each account loads its own saved conversation.
  return <Chat key={user.id} user={user} />;
}

function Chat({ user }: { user: User }) {
  const router = useRouter();

  // Restore the previous conversation for this user, if any.
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = window.localStorage.getItem(chatStorageKey(user.id));
      if (raw) {
        const saved = JSON.parse(raw) as Message[];
        if (Array.isArray(saved) && saved.length > 0) {
          return saved;
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    return [WELCOME];
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist the conversation so navigating away doesn't lose it.
  useEffect(() => {
    if (!user) return;
    try {
      window.localStorage.setItem(chatStorageKey(user.id), JSON.stringify(messages));
    } catch {
      /* storage full / unavailable; skip */
    }
  }, [user, messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startNew = () => {
    if (busy) return;
    setMessages([WELCOME]);
    if (user) {
      try {
        window.localStorage.removeItem(chatStorageKey(user.id));
      } catch {
        /* ignore */
      }
    }
    setInput("");
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setBusy(true);

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", tools: [] }]);

      const abort = new AbortController();
      abortRef.current = abort;

      const applyDelta = (chunk: string) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
        );
      const applyTool = (name: string) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.tools?.includes(name)
              ? { ...m, tools: [...(m.tools ?? []), name] }
              : m,
          ),
        );
      const applyMenu = (items: MenuItem[]) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, menu: items } : m)),
        );
      const applyCategories = (categories: string[]) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, categories } : m)),
        );

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ message: trimmed }),
          signal: abort.signal,
        });

        if (res.status === 401) {
          clearSession();
          router.replace("/login");
          return;
        }

        if (!res.ok) {
          const detail = await res.text();
          applyDelta(`Sorry, I couldn't reach the ordering service. (${res.status} ${detail})`);
          return;
        }
        if (!res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSse<StreamEvent>(buffer);
          for (const ev of parsed) {
            if (ev.type === "delta") applyDelta(ev.content);
            else if (ev.type === "tool") applyTool(ev.name);
            else if (ev.type === "menu") applyMenu(ev.items);
            else if (ev.type === "menu_categories") applyCategories(ev.categories);
            else if (ev.type === "done") {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: ev.content } : m)),
              );
            } else if (ev.type === "error") applyDelta(`Something went wrong: ${ev.message}`);
          }
          const lastBoundary = buffer.lastIndexOf("\n\n");
          if (lastBoundary >= 0) buffer = buffer.slice(lastBoundary + 2);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          applyDelta("\n\n[Stopped]");
        } else {
          applyDelta("\n\n[Connection error — is the backend running?]");
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, router],
  );

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage(text);
  }, [input, busy, sendMessage]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

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
          <h1 className="text-base font-semibold leading-tight">Dineflow</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {user?.name ? `${user.name} · ` : ""}Your restaurant ordering assistant
          </p>
        </div>
        <Link
          href="/orders"
          className="rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-sm font-medium text-orange-600 transition hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60"
        >
          My Orders
        </Link>
        <button
          onClick={startNew}
          disabled={busy}
          className="rounded-full px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          New chat
        </button>
        <button
          onClick={logout}
          className="rounded-full px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          Log out
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "rounded-br-md bg-orange-500 text-white"
                    : "rounded-bl-md bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
                }`}
              >
                {m.tools && m.tools.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {m.tools.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {m.categories && m.categories.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {m.categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => void sendMessage(`Show me ${c}`)}
                        disabled={busy}
                        className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-200 disabled:opacity-50 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                {m.menu && m.menu.length > 0 && (
                  <MenuCart
                    items={m.menu}
                    onPick={(item) => void sendMessage(`I'd like one ${item.name}`)}
                  />
                )}
                {m.content ? (
                  m.content
                ) : m.menu && m.menu.length > 0 ? null : m.categories && m.categories.length > 0 ? null : (
                  <span
                    className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-600"
                    role="status"
                    aria-label="Dineflow is thinking"
                  >
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
                    </span>
                    Thinking…
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <form
          className="mx-auto flex max-w-2xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder={busy ? "Dineflow is thinking…" : 'Try "Show me the menu" or "One pizza please"'}
            className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:ring-orange-800"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {busy ? "…" : "Send"}
          </button>
        </form>
      </footer>
    </div>
  );
}
