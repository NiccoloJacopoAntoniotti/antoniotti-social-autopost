import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Scrivi per il canale Telegram di un negozio di ricambi auto/moto locale
(Antoniotti Autoricambi). Tono educativo, non commerciale: chi legge deve imparare qualcosa di
utile sul componente, non sentirsi venduto un prodotto.

Struttura fissa:
1. Titolo: "🔧 IL RICAMBIO DELLA SETTIMANA"
2. Una riga che pone il sintomo/problema comune che il cliente nota (non il nome tecnico del pezzo)
3. Spiegazione in linguaggio semplice: cos'è il componente, a cosa serve, quali sintomi indicano che
   va controllato o sostituito, perché scegliere quello corretto per il proprio veicolo è importante,
   un errore comune che si fa comprandolo da soli online senza verifica
4. Chiusura (parole tue, non una formula fissa): non diamo per scontato che un pezzo generico vada
   bene sulla loro auto — se non è certo, si scrive con targa/modello per la verifica, e l'assistenza
   continua anche dopo l'acquisto
5. CTA finale verso WhatsApp

Regole assolute:
- NON affermare mai che un ricambio specifico è compatibile con un modello di veicolo: non è
  verificabile in questo contesto, e darlo per certo sarebbe un'informazione tecnica sbagliata a un
  cliente reale. Se il discorso tocca la compatibilità, trasformalo sempre in invito a scrivere con
  la targa.
- Spiega SOLO cosa fa il componente in base alla descrizione fornita, se c'è. Il nome di un
  prodotto può ingannare (es. "Ceramic Power Liquid" non c'entra nulla con vetri o carrozzeria):
  non indovinare mai la funzione dal nome. Senza descrizione, resta sul generico invece di
  inventare specifiche tecniche.
- NON inventare intervalli di sostituzione precisi, specifiche tecniche o numeri (km, mesi) se non
  sei sicuro: resta su indicazioni generiche ("quando noti X, è il momento di farlo controllare").
- Zero linguaggio da ufficio marketing ("scopri la nostra selezione", "qualità e professionalità").
- Non deve sembrare scritto da un bot: frasi naturali, lunghezza variabile, massimo 2 emoji oltre al
  titolo, mai in fila.
- Lunghezza totale MASSIMO 850 caratteri spazi inclusi (limite tecnico: Telegram accetta al massimo
  1024 caratteri come didascalia di una foto, e serve margine per titolo/link). Conta i caratteri
  mentre scrivi: è più importante restare sotto il limite che coprire ogni punto della struttura.
- Rispondi SOLO col testo pronto da incollare su Telegram (il **grassetto** stile Markdown è
  supportato e benvenuto per 1-2 parole chiave), niente spiegazioni fuori dal testo.`;

async function shortenText(text, limit) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 900,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Questo testo per Telegram supera il limite di ${limit} caratteri (è lungo ${text.length}):\n\n${text}\n\nRiscrivilo più corto, sotto i ${limit} caratteri, mantenendo struttura, tono e messaggio (taglia dettagli secondari, non il senso).`,
      },
    ],
  });
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export async function generateTelegramPost(item, { avoidTexts = [] } = {}) {
  const whatsappLink = `https://wa.me/${process.env.WHATSAPP_NUMBER}`;

  const varietyNote = avoidTexts.length
    ? `\n\nGià pubblicati di recente su questo canale — non ripetere la stessa apertura o struttura:\n${avoidTexts
        .map((c, i) => `${i + 1}) ${c.split("\n")[0]}`)
        .join("\n")}`
    : "";

  const descriptionBlock = item.description
    ? `Descrizione reale dal sito (unica fonte per capire cosa fa, usa solo questi fatti): ${item.description}`
    : `Nessuna descrizione disponibile: NON indovinare a cosa serve dal nome, resta generico.`;

  const prompt = `Componente da spiegare questa settimana: ${item.title}
${descriptionBlock}

Il link da inserire nel CTA finale verso WhatsApp è esattamente: ${whatsappLink}` + varietyNote;

  const TELEGRAM_LIMIT = 1024; // limite tecnico di Telegram per la didascalia di una foto

  // La lunghezza reale della risposta varia da un tentativo all'altro: se
  // viene troncata con un budget normale si riprova una volta con più
  // margine, invece di fissare sempre un budget enorme.
  for (const maxTokens of [900, 2000]) {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    if (message.stop_reason === "end_turn") {
      let text = message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      // Il prompt chiede di restare sotto gli 850 caratteri, ma i modelli non
      // rispettano sempre alla lettera un vincolo di conteggio: se il testo
      // supera comunque il limite tecnico di Telegram, si chiede una riscrittura
      // più corta invece di scartare tutto il lavoro fatto finora.
      if (text.length > TELEGRAM_LIMIT) {
        console.error(`Testo Telegram lungo ${text.length}/${TELEGRAM_LIMIT}, chiedo di accorciarlo.`);
        text = await shortenText(text, TELEGRAM_LIMIT - 50);
      }

      if (text.length > TELEGRAM_LIMIT) {
        throw new Error(`Testo Telegram ancora troppo lungo dopo l'accorciamento (${text.length}/${TELEGRAM_LIMIT} caratteri): ${text}`);
      }
      return text;
    }
    console.error(`Telegram troncato con max_tokens=${maxTokens} (stop_reason: ${message.stop_reason}), riprovo.`);
  }

  throw new Error("Generazione Telegram troncata anche al secondo tentativo, non pubblico un testo a metà.");
}
