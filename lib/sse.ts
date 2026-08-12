// Minimal SSE parser for fetch-based streams (EventSource can't send headers).

export function parseSse<T>(buffer: string): T[] {
  const events: T[] = [];
  for (const block of buffer.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    const raw = line.slice(6).trim();
    if (!raw) continue; // ignore empty / comment lines
    try {
      events.push(JSON.parse(raw) as T);
    } catch {
      /* ignore malformed chunk */
    }
  }
  return events;
}
