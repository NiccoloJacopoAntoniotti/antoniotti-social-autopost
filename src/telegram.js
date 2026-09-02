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
