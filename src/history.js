import { readFile, writeFile } from "node:fs/promises";
import { JOLLY_COLLECTION_HANDLE } from "./shopify.js";

const DEFAULT_HISTORY_PATH = new URL("../data/posted-history.json", import.meta.url);
const COOLDOWN_DAYS = 45; // non ripetere lo stesso prodotto/fornitore prima di ~1 mese e mezzo
const COLLECTION_COOLDOWN_DAYS = 7; // non ripetere la stessa collezione prima di una settimana

// Ogni canale (social, contenuto settimanale Telegram/newsletter...) passa il
// proprio file storico, così le rotazioni non si mescolano tra loro pur
// condividendo la stessa logica di raffreddamento.
export async function loadHistory(path = DEFAULT_HISTORY_PATH) {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return [];
  }
}

export async function saveHistoryEntry(entry, path = DEFAULT_HISTORY_PATH) {
  const history = await loadHistory(path);
  history.push({ ...entry, postedAt: new Date().toISOString() });
  await writeFile(path, JSON.stringify(history, null, 2) + "\n");
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

// La collezione jolly è varia al suo interno, quindi può uscire tutti i
// giorni; le altre collezioni (una marca ciascuna) no, per non sembrare che
// si spinga sempre lo stesso fornitore per giorni di fila.
export function filterCollectionCooldown(history, candidates) {
  const cutoff = Date.now() - COLLECTION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const recentCollections = new Set(
    history
      .filter((h) => new Date(h.postedAt).getTime() > cutoff)
      .map((h) => h.collectionHandle)
  );
  return candidates.filter(
    (c) => c.collectionHandle === JOLLY_COLLECTION_HANDLE || !recentCollections.has(c.collectionHandle)
  );
}
