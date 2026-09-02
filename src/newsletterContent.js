import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Scrivi la newsletter email settimanale di un negozio di ricambi auto/moto
locale (Antoniotti Autoricambi), per iscritti che hanno lasciato la mail sul sito. Approfondimento
e relazione, più lungo e ragionato del post social o Telegram sullo stesso componente — non lo
stesso testo riscritto più corto.

Struttura:
- OGGETTO: un problema o una domanda reale dell'automobilista, non il nome del prodotto (es. "La
  batteria ti sta lasciando a piedi? Ecco come capirlo prima.")
- CORPO (testo semplice, niente HTML, niente markdown): il problema che l'automobilista vive,
  spiegazione semplice del componente coinvolto, come riconoscere i sintomi, perché il ricambio
  corretto dipende dal veicolo specifico, come Antoniotti aiuta a trovare quello giusto, CTA finale
  verso il contatto.
- Chiusura sempre con l'idea (parole tue): non compri solo un ricambio, ti accompagniamo dalla
  scelta del componente fino al post vendita — consulenza garantita.

Regole assolute:
- NON affermare mai che un ricambio specifico è compatibile con un modello di veicolo: non è
  verificabile in questo contesto. Se il discorso tocca la compatibilità, trasformalo sempre in
  invito a scrivere con targa/modello per la verifica.
- NON inventare intervalli di sostituzione precisi, specifiche tecniche o numeri (km, mesi) se non
  sei sicuro: resta su indicazioni generiche.
- Zero linguaggio da ufficio marketing, zero frasi fatte.
- Corpo: 150-220 parole.
- Rispondi SOLO con un oggetto JSON valido, senza markdown né blocchi \`\`\`, con esattamente questa
  forma: {"subject": "...", "body": "..."}`;

export async function generateNewsletterEmail(item, { avoidSubjects = [] } = {}) {
  const whatsappLink = `https://wa.me/${process.env.WHATSAPP_NUMBER}`;

  const varietyNote = avoidSubjects.length
    ? `\n\nOggetti già usati di recente — non ripetere la stessa domanda o struttura:\n${avoidSubjects
        .map((s, i) => `${i + 1}) ${s}`)
        .join("\n")}`
    : "";

  const prompt = `Componente al centro della newsletter di questa settimana: ${item.title}

Il link/contatto da inserire nella CTA è esattamente: ${whatsappLink}` + varietyNote;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 700,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.subject || !parsed.body) throw new Error("campi mancanti");
    return parsed;
  } catch (err) {
    throw new Error(`Risposta newsletter non è JSON valido: ${err.message}\n---\n${raw}`);
  }
}
