import { getFeaturedCollectionProducts } from "./shopify.js";
import { generateCaption } from "./caption.js";
import { postToInstagram, postToInstagramStory, postToFacebook } from "./meta.js";
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

async function pickNextItem() {
  const history = await loadHistory();

  const products = (await getFeaturedCollectionProducts({ limit: 10 })).map((p) => ({
    kind: "product",
    key: `product:${p.id}`,
    title: p.title,
    price: p.price,
    imageUrl: p.imageUrl,
    productUrl: p.productUrl,
  }));

  const fresh = filterRecentlyPosted(history, products, (c) => c.key);
  if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)];

  // tutto già postato di recente: meglio ripetere un prodotto che saltare il post
  return products[0] ?? null;
}

async function main() {
  assertEnv();

  const item = await pickNextItem();
  if (!item) {
    console.log("Nessun prodotto con foto disponibile nelle collezioni in evidenza, salto questo giro.");
    return;
  }

  console.log(`Pubblico: [${item.kind}] ${item.title}`);
  const history = await loadHistory();
  const caption = await generateCaption(item, { avoidCaptions: recentCaptions(history) });
  console.log("Caption generata:\n" + caption);

  await postToInstagram({ imageUrl: item.imageUrl, caption });
  await postToInstagramStory({ imageUrl: item.imageUrl });
  await postToFacebook({ imageUrl: item.imageUrl, caption });

  await saveHistoryEntry({ key: item.key, title: item.title, kind: item.kind, caption });
  console.log("Pubblicato con successo su Instagram (feed + storia) e Facebook.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
