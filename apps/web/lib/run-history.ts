/**
 * Local record of runs started from this browser.
 *
 * Frontend adapter, not a contract change: the frozen API exposes `GET /api/runs/:runId`
 * but no "list runs" endpoint, so the dashboard remembers the run ids it created and
 * re-hydrates each one from the real API. See "Backend contract requests" in
 * `apps/web/README.md`.
 */

const STORAGE_KEY = 'voicefuzz.run-history.v1';
const MAX_ENTRIES = 8;

export interface RunHistoryEntry {
  runId: string;
  agentId: string;
  startedAt: string;
  suiteIds: string[];
  seed: number;
  targetVariant: 'vulnerable' | 'guarded';
}

function safeParse(raw: string | null): RunHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RunHistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RunHistoryEntry).runId === 'string',
    );
  } catch {
    return [];
  }
}

export function listRunHistory(): RunHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function recordRun(entry: RunHistoryEntry): void {
  if (typeof window === 'undefined') return;
  const existing = listRunHistory().filter((item) => item.runId !== entry.runId);
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
