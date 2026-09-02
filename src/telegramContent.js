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
- NON inventare intervalli di sostituzione precisi, specifiche tecniche o numeri (km, mesi) se non
  sei sicuro: resta su indicazioni generiche ("quando noti X, è il momento di farlo controllare").
- Zero linguaggio da ufficio marketing ("scopri la nostra selezione", "qualità e professionalità").
- Non deve sembrare scritto da un bot: frasi naturali, lunghezza variabile, massimo 2 emoji oltre al
  titolo, mai in fila.
- Lunghezza totale: 120-180 parole.
- Rispondi SOLO col testo pronto da incollare su Telegram (il **grassetto** stile Markdown è
  supportato e benvenuto per 1-2 parole chiave), niente spiegazioni fuori dal testo.`;

export async function generateTelegramPost(item, { avoidTexts = [] } = {}) {
  const whatsappLink = `https://wa.me/${process.env.WHATSAPP_NUMBER}`;

  const varietyNote = avoidTexts.length
    ? `\n\nGià pubblicati di recente su questo canale — non ripetere la stessa apertura o struttura:\n${avoidTexts
        .map((c, i) => `${i + 1}) ${c.split("\n")[0]}`)
        .join("\n")}`
    : "";

  const prompt = `Componente da spiegare questa settimana: ${item.title}

Il link da inserire nel CTA finale verso WhatsApp è esattamente: ${whatsappLink}` + varietyNote;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  if (message.stop_reason !== "end_turn") {
    throw new Error(`Generazione Telegram troncata (stop_reason: ${message.stop_reason}), non pubblico un testo a metà.`);
  }

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
