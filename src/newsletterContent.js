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
- Rispondi SOLO in questo formato esatto, niente altro testo prima o dopo:
OGGETTO: <oggetto qui, su una riga sola>
---
<corpo della mail qui, testo semplice>`;

export async function generateNewsletterEmail(item, { avoidSubjects = [] } = {}) {
  const whatsappLink = `https://wa.me/${process.env.WHATSAPP_NUMBER}`;

  const varietyNote = avoidSubjects.length
    ? `\n\nOggetti già usati di recente — non ripetere la stessa domanda o struttura:\n${avoidSubjects
        .map((s, i) => `${i + 1}) ${s}`)
        .join("\n")}`
    : "";

  const prompt = `Componente al centro della newsletter di questa settimana: ${item.title}

Il link/contatto da inserire nella CTA è esattamente: ${whatsappLink}` + varietyNote;

  // La lunghezza reale della risposta varia da un tentativo all'altro: se
  // viene troncata con un budget normale si riprova una volta con più
  // margine, invece di fissare sempre un budget enorme.
  for (const maxTokens of [1200, 2500]) {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    if (message.stop_reason === "end_turn") {
      const raw = message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      const match = raw.match(/^OGGETTO:\s*(.+?)\s*\n---\s*\n([\s\S]+)$/);
      if (!match) {
        throw new Error(`Risposta newsletter non nel formato atteso "OGGETTO: ...\\n---\\n...":\n${raw}`);
      }
      return { subject: match[1].trim(), body: match[2].trim() };
    }
    console.error(`Newsletter troncata con max_tokens=${maxTokens} (stop_reason: ${message.stop_reason}), riprovo.`);
  }

  throw new Error("Generazione newsletter troncata anche al secondo tentativo, non la uso a metà.");
}
