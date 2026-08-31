import { readFile, writeFile } from "node:fs/promises";

const HISTORY_PATH = new URL("../data/posted-history.json", import.meta.url);
const COOLDOWN_DAYS = 45; // non ripetere lo stesso prodotto/fornitore prima di ~1 mese e mezzo

export async function loadHistory() {
  try {
    return JSON.parse(await readFile(HISTORY_PATH, "utf-8"));
  } catch {
    return [];
  }
}

export async function saveHistoryEntry(entry) {
  const history = await loadHistory();
  history.push({ ...entry, postedAt: new Date().toISOString() });
  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n");
}

export function recentCaptions(history, count = 5) {
  return history
    .slice(-count)
    .map((h) => h.caption)
    .filter(Boolean);
}

export function filterRecentlyPosted(history, candidates, keyFn) {
  const cutoff = Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const recentKeys = new Set(
    history.filter((h) => new Date(h.postedAt).getTime() > cutoff).map((h) => h.key)
  );
  return candidates.filter((c) => !recentKeys.has(keyFn(c)));
}
