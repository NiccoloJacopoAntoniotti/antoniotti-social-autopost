import { readFile, writeFile } from "node:fs/promises";
import {
  postToInstagramCarousel,
  postToInstagramStory,
  postToFacebookMultiPhoto,
  getInstagramPermalink,
} from "./meta.js";
import { postToTelegramChannelWithButtons } from "./telegram.js";
import { commitAndPush } from "./git.js";
import {
  INSTAGRAM_CAROUSEL_CAPTION,
  FACEBOOK_CAPTION,
  TELEGRAM_CAPTION_HTML,
  TELEGRAM_BUTTONS,
} from "./launchContent.js";

// Contenuto straordinario (una tantum): lancio del nuovo sito. Ha un proprio
// file di stato, separato da data/posted-history.json: così NON consuma lo
// slot del post quotidiano (il controllo "già pubblicato oggi" dei post
// ordinari non lo vede) e, all'inverso, un post ordinario già uscito oggi non
// blocca il lancio. Lo stato è per canale: se un canale fallisce, rilanciando
// si riprovano solo quelli non riusciti, mai quelli già pubblicati.
const LAUNCH_ID = "nuovo-sito-2026-10";
const REPO = "NiccoloJacopoAntoniotti/antoniotti-social-autopost";
const STATE_RELATIVE_PATH = "data/launch-history.json";
const STATE_PATH = new URL(`../${STATE_RELATIVE_PATH}`, import.meta.url);
const DRY_RUN = process.env.LAUNCH_DRY_RUN === "true";

const rawUrl = (file) =>
  `https://raw.githubusercontent.com/${REPO}/main/data/launch/${file}?v=${LAUNCH_ID}`;
const SLIDES = [1, 2, 3, 4, 5].map((n) => rawUrl(`slide-${n}.jpg`));
const STORY = rawUrl("story.jpg");

const REQUIRED_ENV = ["META_PAGE_ID", "META_IG_USER_ID", "META_PAGE_ACCESS_TOKEN", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHANNEL_ID"];

function assertEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Variabili d'ambiente mancanti: ${missing.join(", ")}`);
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf-8"));
  } catch {
    return { id: LAUNCH_ID, channels: {} };
  }
}

async function saveState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

// Prima di pubblicare qualunque cosa, verifica che tutte le immagini siano
// raggiungibili all'URL pubblico che userà Meta/Telegram.
async function assertImagesReachable() {
  for (const url of [...SLIDES, STORY]) {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) throw new Error(`Immagine non raggiungibile (${res.status}): ${url}`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("image/jpeg")) throw new Error(`Tipo inatteso (${type}) per ${url}`);
  }
  console.log(`Immagini raggiungibili: ${SLIDES.length} slide + storia.`);
}

const STEPS = [
  {
    key: "instagramCarousel",
    label: "Carosello Instagram",
    run: async () => {
      const { id } = await postToInstagramCarousel({ imageUrls: SLIDES, caption: INSTAGRAM_CAROUSEL_CAPTION });
      return { id, link: await getInstagramPermalink(id) };
    },
  },
  {
    key: "instagramStory",
    label: "Storia Instagram",
    run: async () => {
      const { id } = await postToInstagramStory({ imageUrl: STORY });
      // I permalink delle storie scadono con la storia (24h): si salva solo l'id.
      return { id, link: null };
    },
  },
  {
    key: "facebook",
    label: "Facebook (post con 5 foto)",
    run: async () => {
      const { id } = await postToFacebookMultiPhoto({ imageUrls: SLIDES, caption: FACEBOOK_CAPTION });
      return { id, link: `https://www.facebook.com/${id}` };
    },
  },
  {
    key: "telegram",
    label: "Telegram",
    run: async () => {
      const message = await postToTelegramChannelWithButtons({
        imageUrl: SLIDES[0],
        captionHtml: TELEGRAM_CAPTION_HTML,
        buttons: TELEGRAM_BUTTONS,
      });
      return { id: String(message.message_id), link: `https://t.me/antoniottiautoricambi/${message.message_id}` };
    },
  },
];

async function main() {
  if (TELEGRAM_CAPTION_HTML.length > 1000) {
    throw new Error(`Didascalia Telegram troppo lunga (${TELEGRAM_CAPTION_HTML.length}/1024).`);
  }
  assertEnv();
  await assertImagesReachable();

  if (DRY_RUN) {
    console.log("DRY RUN: nessuna pubblicazione. Testi che verrebbero usati:\n");
    console.log("--- Instagram ---\n" + INSTAGRAM_CAROUSEL_CAPTION + `\n(${INSTAGRAM_CAROUSEL_CAPTION.length} caratteri)\n`);
    console.log("--- Facebook ---\n" + FACEBOOK_CAPTION + "\n");
    console.log("--- Telegram ---\n" + TELEGRAM_CAPTION_HTML + `\n(${TELEGRAM_CAPTION_HTML.length}/1024 caratteri)`);
    const state = await loadState();
    console.log("\nStato attuale dei canali:", JSON.stringify(state.channels));
    return;
  }

  const state = await loadState();
  const failures = [];

  for (const step of STEPS) {
    if (state.channels[step.key]?.done) {
      console.log(`${step.label}: già pubblicato, salto.`);
      continue;
    }
    try {
      const result = await step.run();
      state.channels[step.key] = { done: true, postedAt: new Date().toISOString(), ...result };
      console.log(`${step.label}: pubblicato.${result.link ? " " + result.link : ""}`);
    } catch (err) {
      console.error(`${step.label}: ERRORE`, err);
      state.channels[step.key] = { done: false, error: String(err.message ?? err).slice(0, 500), failedAt: new Date().toISOString() };
      failures.push(step.label);
    }
    // Salva e committa subito dopo ogni canale: se il run viene interrotto,
    // quello che è già uscito risulta comunque registrato.
    await saveState(state);
    commitAndPush(STATE_RELATIVE_PATH, `chore: stato lancio nuovo sito (${step.key})`);
  }

  if (failures.length) throw new Error(`Lancio parziale, canali falliti: ${failures.join(", ")}. Rilanciare per riprovare solo quelli.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
