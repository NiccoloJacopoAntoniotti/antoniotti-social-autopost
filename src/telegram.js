// Pubblica sul canale Telegram tramite un bot creato con @BotFather.
// Richiede TELEGRAM_BOT_TOKEN (token del bot) e TELEGRAM_CHANNEL_ID (es.
// "@antoniottiautoricambi" se il canale è pubblico, oppure l'ID numerico).
export async function postToTelegramChannel({ imageUrl, caption }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN o TELEGRAM_CHANNEL_ID mancanti: impossibile pubblicare su Telegram.");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: imageUrl,
      caption,
      parse_mode: "Markdown",
    }),
  });

  if (!res.ok) {
    throw new Error(`Telegram API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Foto con didascalia in HTML e pulsanti-link sotto il messaggio (solo i post
// singoli supportano i pulsanti inline, non gli album). Restituisce il
// messaggio pubblicato, da cui si ricava il link diretto al post.
export async function postToTelegramChannelWithButtons({ imageUrl, captionHtml, buttons }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN o TELEGRAM_CHANNEL_ID mancanti: impossibile pubblicare su Telegram.");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: imageUrl,
      caption: captionHtml,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [buttons.map((b) => ({ text: b.text, url: b.url }))] },
    }),
  });

  if (!res.ok) {
    throw new Error(`Telegram API error ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).result;
}
