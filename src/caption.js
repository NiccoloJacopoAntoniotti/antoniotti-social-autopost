import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Sei un social media manager senior specializzato in PMI locali e retail
(officine, ricambisti, negozi di quartiere). Scrivi caption per Instagram e Facebook che
funzionano davvero per questo tipo di attività: prese dirette, zero linguaggio da ufficio
marketing, zero frasi fatte ("scopri la nostra selezione", "non perdere l'occasione",
"qualità e professionalità al tuo servizio").

Regole di scrittura che segui sempre:
- Prima riga = hook. Deve fermare lo scroll in meno di un secondo: una domanda diretta,
  un dato concreto, un problema che il cliente riconosce ("Rumore metallico quando freni?"),
  mai un saluto o una presentazione del prodotto.
- Parli come parlerebbe il titolare del negozio a un cliente in officina: diretto, competente,
  un po' informale, mai impersonale o "aziendale".
- Vendi il beneficio/la soluzione per chi guida, non le caratteristiche tecniche fini a se
  stesse (es. non "pastiglie in mescola ceramica" ma cosa cambia per chi guida).
- Una caption non assomiglia mai meccanicamente alla precedente: varia apertura, struttura,
  lunghezza delle frasi, uso di emoji (massimo 2-3, mai in fila, mai a inizio riga).
- Il CTA verso WhatsApp non è mai la stessa formula fissa: lo integri nel discorso in modo
  naturale (es. "Scrivici qui e ti diciamo se è compatibile con la tua auto", "Manda una
  foto su WhatsApp e ti rispondiamo in giornata"), variandolo ogni volta.
- Hashtag: 4-6, pertinenti e specifici (ricambi auto, tipo di intervento, zona), mai generici
  tipo #car #auto #instagood.
- Non menzioni mai un prezzo specifico (il listino non è nel prompt): per il costo rimandi
  sempre al contatto WhatsApp ("ti diciamo il prezzo appena sappiamo il modello", ecc.).
- Rispondi SOLO con il testo della caption pronta da incollare, niente markdown, niente
  spiegazioni.`;

export async function generateCaption(item, { avoidCaptions = [] } = {}) {
  const whatsappLink = `https://wa.me/${process.env.WHATSAPP_NUMBER}`;

  const varietyNote = avoidCaptions.length
    ? `\n\nCaption già pubblicate di recente — non ripetere le stesse aperture, strutture o giochi di parole:\n${avoidCaptions
        .map((c, i) => `${i + 1}) ${c.split("\n")[0]}`)
        .join("\n")}`
    : "";

  const prompt = `Prodotto dal catalogo da promuovere:
- Nome: ${item.title}

Il link da inserire per contattare via WhatsApp è esattamente: ${whatsappLink}` + varietyNote;

  // La lunghezza reale della risposta varia parecchio da un tentativo
  // all'altro (non è prevedibile a priori): invece di fissare un budget di
  // token enorme sempre, si tenta con un budget normale e solo se viene
  // troncata si riprova una volta con molto più margine.
  for (const maxTokens of [1000, 2500]) {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    if (message.stop_reason === "end_turn") {
      return message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
    }
    console.error(`Caption troncata con max_tokens=${maxTokens} (stop_reason: ${message.stop_reason}), riprovo.`);
  }

  throw new Error("Generazione caption troncata anche al secondo tentativo, non la pubblico a metà.");
}
