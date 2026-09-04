import { pickNextItem } from "./picker.js";
import { loadHistory, saveHistoryEntry, recentCaptions } from "./history.js";
import { generateTelegramPost } from "./telegramContent.js";
import { generateNewsletterEmail } from "./newsletterContent.js";
import { postToTelegramChannel } from "./telegram.js";
import { commitAndPush } from "./git.js";
import { writeFile } from "node:fs/promises";

const WEEKLY_HISTORY_PATH = new URL("../data/weekly-history.json", import.meta.url);
const DRAFT_RELATIVE_PATH = "data/weekly-draft.md";
const DRAFT_ABSOLUTE_PATH = new URL(`../${DRAFT_RELATIVE_PATH}`, import.meta.url);

// Finché non hai verificato la qualità dei contenuti per qualche settimana,
// questo resta in modalità bozza: genera Telegram + newsletter, li scrive in
// data/weekly-draft.md e li committa nel repo, ma NON pubblica nulla di
// reale. Metti il secret/variabile WEEKLY_DRAFT_MODE=false nel workflow solo
// quando vuoi che Telegram venga pubblicato per davvero (la newsletter resta
// comunque sempre bozza da incollare in Shopify Email: non esiste un'API per
// inviarla in automatico).
const DRAFT_MODE = process.env.WEEKLY_DRAFT_MODE !== "false";

const REQUIRED_ENV = [
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_ADMIN_TOKEN",
  "SHOPIFY_PUBLIC_DOMAIN",
  "ANTHROPIC_API_KEY",
  "WHATSAPP_NUMBER",
];

function assertEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Variabili d'ambiente mancanti: ${missing.join(", ")}`);
  }
}

function alreadyPostedToday(history) {
  const today = new Date().toISOString().slice(0, 10); // data UTC, stesso fuso del cron
  return history.some((h) => h.postedAt?.slice(0, 10) === today);
}

async function main() {
  assertEnv();

  const history = await loadHistory(WEEKLY_HISTORY_PATH);

  // Stesso motivo del post social: il cron di GitHub può partire in ritardo
  // o saltare una finestra, quindi il workflow ha più orari di ripescaggio
  // nella stessa mattina di lunedì. Se oggi si è già generato/pubblicato,
  // i run successivi non devono ripetere il lavoro.
  if (alreadyPostedToday(history)) {
    console.log("Già generato oggi, salto questo giro (è un run di ripescaggio).");
    return;
  }

  const item = await pickNextItem(history);
  if (!item) {
    console.log("Nessun prodotto disponibile per il contenuto settimanale, salto questo giro.");
    return;
  }

  console.log(`Prodotto della settimana: ${item.title}`);

  const avoidTexts = recentCaptions(history, 4);
  const telegramText = await generateTelegramPost(item, { avoidTexts });
  const newsletter = await generateNewsletterEmail(item, {
    avoidSubjects: history.slice(-4).map((h) => h.newsletterSubject).filter(Boolean),
  });

  console.log("Telegram generato:\n" + telegramText);
  console.log("\nNewsletter generata — oggetto: " + newsletter.subject);

  const draftMarkdown = `# Contenuto della settimana — ${new Date().toISOString().slice(0, 10)}

## Prodotto scelto
${item.title} — collezione: ${item.collectionHandle}
Foto: ${item.imageUrl}

## Telegram (canale: https://t.me/antoniottiautoricambi)
Stato: ${DRAFT_MODE ? "BOZZA — non pubblicato, da rivedere" : "pubblicato automaticamente"}

${telegramText}

## Newsletter (da incollare in Shopify Email — invio sempre manuale)
Oggetto: ${newsletter.subject}

${newsletter.body}
`;

  await writeFile(DRAFT_ABSOLUTE_PATH, draftMarkdown);
  console.log("\nBozza scritta in " + DRAFT_RELATIVE_PATH);

  // Salva bozza + storico PRIMA di provare a pubblicare su Telegram: se
  // l'invio fallisce (rete, permessi, limite caratteri...) il lavoro già
  // fatto (scelta prodotto, testi generati) non va perso e resta comunque
  // nel repo da rivedere, invece di sparire con un processo interrotto.
  await saveHistoryEntry(
    {
      key: item.key,
      title: item.title,
      kind: item.kind,
      caption: telegramText,
      newsletterSubject: newsletter.subject,
      collectionHandle: item.collectionHandle,
      draftOnly: DRAFT_MODE,
    },
    WEEKLY_HISTORY_PATH
  );

  commitAndPush(
    [DRAFT_RELATIVE_PATH, "data/weekly-history.json"],
    "chore: aggiorna bozza contenuto settimanale (Telegram + newsletter)"
  );

  if (!DRAFT_MODE) {
    await postToTelegramChannel({ imageUrl: item.imageUrl, caption: telegramText });
    console.log("Pubblicato su Telegram.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
