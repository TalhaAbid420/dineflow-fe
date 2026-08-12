"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getUser, homeForRole, setSession, type User } from "@/lib/auth";

type Mode = "login" | "register";

interface AuthResponse {
  token: string;
  user: User;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (user) router.replace(homeForRole(user.role));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { name, email, password } : { email, password },
        ),
      });
      const data = (await res.json()) as AuthResponse & { detail?: string };
      if (!res.ok) {
        setError(data.detail ?? "Something went wrong. Try again.");
        return;
      }
      setSession(data.token, data.user);
      router.replace(homeForRole(data.user.role));
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Image
            src="/dineflow-logo.png"
            alt="Dineflow logo"
            width={56}
            height={56}
            className="h-14 w-14 rounded-2xl object-contain"
            priority
          />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Dineflow
          </h1>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`rounded-full py-2 text-sm font-medium capitalize transition ${
                mode === m
                  ? "bg-white text-zinc-900 shadow dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "register" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="Email"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            placeholder="Password"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950"
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !email || !password}
            className="mt-1 rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-400">
          Chef? Sign in with your chef account to open the kitchen dashboard.
        </p>
      </div>
    </div>
  );
}
