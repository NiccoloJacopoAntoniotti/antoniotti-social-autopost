import { readFile } from "node:fs/promises";
import { getBestSellingProducts } from "./shopify.js";
import { generateCaption } from "./caption.js";
import { postToInstagram, postToFacebook } from "./meta.js";
import { loadHistory, saveHistoryEntry, filterRecentlyPosted, recentCaptions } from "./history.js";

const REQUIRED_ENV = [
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_ADMIN_TOKEN",
  "SHOPIFY_PUBLIC_DOMAIN",
  "META_PAGE_ID",
  "META_IG_USER_ID",
  "META_PAGE_ACCESS_TOKEN",
  "ANTHROPIC_API_KEY",
  "WHATSAPP_NUMBER",
];

function assertEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Variabili d'ambiente mancanti: ${missing.join(", ")}`);
  }
}

async function loadEnabledSuppliers() {
  const raw = await readFile(new URL("../config/suppliers.json", import.meta.url), "utf-8");
  return JSON.parse(raw).filter((s) => s.enabled !== false);
}

async function pickNextItem() {
  const history = await loadHistory();

  const products = (await getBestSellingProducts({ days: 30, limit: 10 })).map((p) => ({
    kind: "product",
    key: `product:${p.id}`,
    title: p.title,
    price: p.price,
    imageUrl: p.imageUrl,
  }));

  const suppliers = (await loadEnabledSuppliers()).map((s) => ({
    kind: "supplier",
    key: `supplier:${s.title}`,
    title: s.title,
    description: s.description,
    imageUrl: s.imageUrl,
  }));

  // 2 post su 3 a settimana pescano da prodotti best seller, 1 da fornitori/servizi,
  // ma se una delle due liste è vuota si ripiega sull'altra.
  const pool = suppliers.length > 0 && Math.random() < 1 / 3 ? suppliers : products;
  const fallbackPool = pool === products ? suppliers : products;

  const fresh = filterRecentlyPosted(history, pool, (c) => c.key);
  if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)];

  const freshFallback = filterRecentlyPosted(history, fallbackPool, (c) => c.key);
  if (freshFallback.length > 0) return freshFallback[Math.floor(Math.random() * freshFallback.length)];

  // tutto già postato di recente: meglio ripetere il best seller assoluto che saltare il post
  return pool[0] ?? fallbackPool[0] ?? null;
}

async function main() {
  assertEnv();

  const item = await pickNextItem();
  if (!item) {
    console.log("Nessun prodotto o fornitore disponibile da pubblicare, salto questo giro.");
    return;
  }

  console.log(`Pubblico: [${item.kind}] ${item.title}`);
  const history = await loadHistory();
  const caption = await generateCaption(item, { avoidCaptions: recentCaptions(history) });
  console.log("Caption generata:\n" + caption);

  await postToInstagram({ imageUrl: item.imageUrl, caption });
  await postToFacebook({ imageUrl: item.imageUrl, caption });

  await saveHistoryEntry({ key: item.key, title: item.title, kind: item.kind, caption });
  console.log("Pubblicato con successo su Instagram e Facebook.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
