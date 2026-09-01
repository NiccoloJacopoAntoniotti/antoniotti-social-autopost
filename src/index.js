import { getFeaturedCollectionProducts } from "./shopify.js";
import { generateCaption } from "./caption.js";
import { postToInstagram, postToInstagramStory, postToFacebook } from "./meta.js";
import { loadHistory, saveHistoryEntry, filterRecentlyPosted, recentCaptions } from "./history.js";
import { buildStoryImage } from "./storyImage.js";
import { commitAndPush } from "./git.js";
import { writeFile } from "node:fs/promises";

// Repo pubblico usato anche come hosting per l'immagine generata delle storie
// (Instagram richiede un URL pubblico, raw.githubusercontent.com lo fornisce
// gratis per i repo pubblici).
const REPO = "NiccoloJacopoAntoniotti/antoniotti-social-autopost";
const STORY_IMAGE_PATH = "data/story-image.jpg";

function formatWhatsappNumber(raw) {
  // Numeri italiani: 39 + 3 + 3 + 4 cifre (es. 393272436497 -> +39 327 243 6497)
  const match = raw.match(/^39(\d{3})(\d{3})(\d{4})$/);
  return match ? `+39 ${match[1]} ${match[2]} ${match[3]}` : `+${raw}`;
}

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

// Tag da mettere sui prodotti (es. collezione "Social - In evidenza") il cui
// contenuto ha senso solo in una stagione precisa (es. "Stagionali inverno",
// "Climatizzazione"). Non è un vincolo rigido: fuori da inverno/estate non c'è
// nessuna esclusione, si pesca da tutto normalmente.
const SEASON_TAG_WINTER = "stagione-inverno";
const SEASON_TAG_SUMMER = "stagione-estate";

function isOffSeason(tags) {
  const month = new Date().getMonth() + 1; // 1-12
  if ([12, 1, 2].includes(month)) return tags.includes(SEASON_TAG_SUMMER); // inverno: niente prodotti estivi
  if ([6, 7, 8].includes(month)) return tags.includes(SEASON_TAG_WINTER); // estate: niente prodotti invernali
  return false; // primavera/autunno: nessun vincolo stagionale
}

async function pickNextItem() {
  const history = await loadHistory();

  const products = (await getFeaturedCollectionProducts({ limit: 10 }))
    .filter((p) => !isOffSeason(p.tags))
    .map((p) => ({
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

  // Il post sul feed Instagram è la pubblicazione "principale": appena riesce,
  // salviamo subito lo storico. Così, se storia o Facebook falliscono dopo,
  // un eventuale nuovo tentativo non ripubblica lo stesso prodotto da capo.
  await postToInstagram({ imageUrl: item.imageUrl, caption });
  await saveHistoryEntry({ key: item.key, title: item.title, kind: item.kind, caption });
  console.log("Pubblicato sul feed Instagram.");

  const failures = [];

  try {
    const storyBuffer = await buildStoryImage({
      imageUrl: item.imageUrl,
      title: item.title,
      whatsappNumber: formatWhatsappNumber(process.env.WHATSAPP_NUMBER), // niente emoji: i renderer SVG headless spesso non hanno i font a colori
      siteDomain: process.env.SHOPIFY_PUBLIC_DOMAIN,
      logoPath: new URL("../assets/logo.jpg", import.meta.url),
    });
    await writeFile(new URL(`../${STORY_IMAGE_PATH}`, import.meta.url), storyBuffer);
    commitAndPush(STORY_IMAGE_PATH, "chore: aggiorna immagine storia social autopost");
    await new Promise((resolve) => setTimeout(resolve, 5000)); // dà tempo alla CDN di propagare il file

    const storyImageUrl = `https://raw.githubusercontent.com/${REPO}/main/${STORY_IMAGE_PATH}?t=${Date.now()}`;
    await postToInstagramStory({ imageUrl: storyImageUrl });
    console.log("Pubblicata anche la storia Instagram (con overlay).");
  } catch (err) {
    console.error("Errore nella pubblicazione della storia Instagram:", err);
    failures.push("storia Instagram");
  }

  try {
    await postToFacebook({ imageUrl: item.imageUrl, caption });
    console.log("Pubblicato anche su Facebook.");
  } catch (err) {
    console.error("Errore nella pubblicazione su Facebook:", err);
    failures.push("Facebook");
  }

  if (failures.length > 0) {
    throw new Error(`Pubblicazione riuscita solo parzialmente, falliti: ${failures.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
