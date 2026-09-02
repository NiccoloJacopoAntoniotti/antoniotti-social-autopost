import { readFile, writeFile } from "node:fs/promises";
import { generateAutoReply } from "./autoReplyContent.js";
import { commitAndPush } from "./git.js";

const OFFSET_RELATIVE_PATH = "data/telegram-offset.json";
const OFFSET_PATH = new URL(`../${OFFSET_RELATIVE_PATH}`, import.meta.url);

const REQUIRED_ENV = ["ANTHROPIC_API_KEY", "TELEGRAM_BOT_TOKEN"];

function assertEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Variabili d'ambiente mancanti: ${missing.join(", ")}`);
  }
}

async function loadOffset() {
  try {
    return JSON.parse(await readFile(OFFSET_PATH, "utf-8")).lastUpdateId ?? 0;
  } catch {
    return 0;
  }
}

async function saveOffset(lastUpdateId) {
  await writeFile(OFFSET_PATH, JSON.stringify({ lastUpdateId }, null, 2) + "\n");
}

function telegramUrl(method) {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

async function getUpdates(offset) {
  const res = await fetch(`${telegramUrl("getUpdates")}?offset=${offset}&timeout=0`);
  if (!res.ok) throw new Error(`Telegram getUpdates error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result ?? [];
}

async function sendMessage(chatId, text) {
  const res = await fetch(telegramUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`Telegram sendMessage error ${res.status}: ${await res.text()}`);
}

async function main() {
  assertEnv();

  const sinceOffset = await loadOffset();
  const updates = await getUpdates(sinceOffset);

  if (updates.length === 0) {
    console.log("Nessun nuovo messaggio.");
    return;
  }

  let lastUpdateId = sinceOffset - 1;

  for (const update of updates) {
    lastUpdateId = update.update_id;

    // Solo messaggi privati diretti al bot, con testo: niente reazioni ai
    // post del canale stesso (li pubblica il bot), niente gruppi non
    // richiesti — chi scrive in privato al bot lo ha cercato lui.
    const message = update.message;
    if (!message || message.chat?.type !== "private" || !message.text) continue;

    try {
      const reply = await generateAutoReply(message.text);
      await sendMessage(message.chat.id, reply);
      console.log(`Risposto a ${message.chat.id}: "${message.text.slice(0, 60)}" -> "${reply.slice(0, 60)}"`);
    } catch (err) {
      // Un errore su un singolo messaggio non deve bloccare gli altri in coda.
      console.error(`Errore rispondendo a ${message.chat.id}:`, err);
    }
  }

  await saveOffset(lastUpdateId + 1);
  commitAndPush(OFFSET_RELATIVE_PATH, "chore: aggiorna offset messaggi Telegram elaborati");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
