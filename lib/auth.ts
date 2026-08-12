// Client-side auth helpers backed by localStorage.
// Use `useSession()` in components — it subscribes to changes via
// useSyncExternalStore so pages re-render on login/logout.

import { useSyncExternalStore } from "react";

export type Role = "customer" | "chef";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

const TOKEN_KEY = "dineflow_token";
const USER_KEY = "dineflow_user";

type Listener = () => void;
const listeners = new Set<Listener>();

// Cached snapshots. `undefined` means "not computed yet"; null is a valid
// cached value (not logged in). useSyncExternalStore requires getSnapshot to
// return a stable reference between calls, so we must NOT parse on every read.
let cachedToken: string | null | undefined;
let cachedUser: User | null | undefined;

function computeToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function computeUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function refreshCache(): void {
  cachedToken = computeToken();
  cachedUser = computeUser();
}

function notify(): void {
  refreshCache();
  for (const l of listeners) l();
}

function subscribe(callback: Listener): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", notify);
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      window.removeEventListener("storage", notify);
    }
  };
}

function readToken(): string | null {
  if (cachedToken === undefined) cachedToken = computeToken();
  return cachedToken;
}

function readUser(): User | null {
  if (cachedUser === undefined) cachedUser = computeUser();
  return cachedUser;
}

export function getToken(): string | null {
  return computeToken();
}

export function getUser(): User | null {
  return computeUser();
}

export function setSession(token: string, user: User): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify();
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  notify();
}

export function authHeaders(): Record<string, string> {
  const token = computeToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function homeForRole(role: Role): string {
  return role === "chef" ? "/chef" : "/";
}

export function useSession(): { user: User | null; token: string | null } {
  const token = useSyncExternalStore(subscribe, readToken, () => null);
  const user = useSyncExternalStore(subscribe, readUser, () => null);
  return { user, token };
}
