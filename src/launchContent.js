// Testi del lancio del nuovo sito (contenuto straordinario, scritto a mano e
// riletto: non passa dall'IA, quindi niente prezzi, promozioni o disponibilità
// inventati). Ogni affermazione corrisponde a ciò che il sito dice davvero:
// - "più di 300 prodotti": il catalogo pubblico ne conta 322
// - prezzo e disponibilità si confermano su WhatsApp dopo la verifica targa
// - consulenza prima e dopo l'acquisto ("Consulenza garantita" nel banner)

export const SITE_URL = "https://antoniotti-autoricambi.com";
export const SITE_DOMAIN = "antoniotti-autoricambi.com";
export const WHATSAPP_DISPLAY = "+39 327 243 6497";

const intro =
  "Nuova grafica, navigazione più chiara e un modo più semplice per trovare il ricambio giusto: auto e moto, in un unico posto.";

export const INSTAGRAM_CAROUSEL_CAPTION = `🚗 Il nuovo sito Antoniotti Autoricambi è online!

${intro}

✔️ Cerca per targa e scegli cosa ti serve: il messaggio WhatsApp si scrive da solo
✔️ Nuove collezioni: olio motore, sistema frenante, lampadine e fari LED, tagliando, accessori inverno e moto
✔️ Più di 300 prodotti: prezzo e disponibilità te li confermiamo noi su WhatsApp, dopo la verifica della targa

Scorri il carosello per vedere com'è fatto 👉 poi entra: ${SITE_DOMAIN}

Non sai quale ricambio ti serve? Scrivici su WhatsApp ${WHATSAPP_DISPLAY}: ti aiutiamo a trovare quello giusto per la tua auto o moto, prima e dopo l'acquisto.

📍 Via Civardi, 44 – Stradella (PV)

#AntoniottiAutoricambi #Autoricambi #RicambiAuto #AccessoriAuto #AccessoriMoto #Stradella #Pavia #NuovoSito`;

export const FACEBOOK_CAPTION = `🚗 Il nuovo sito Antoniotti Autoricambi è online!

${intro}

✔️ Cerca per targa e scegli cosa ti serve: il messaggio WhatsApp si scrive da solo
✔️ Nuove collezioni: olio motore, sistema frenante, lampadine e fari LED, tagliando, accessori inverno e moto
✔️ Più di 300 prodotti: prezzo e disponibilità te li confermiamo noi su WhatsApp, dopo la verifica della targa

👉 Scopri il nuovo sito: ${SITE_URL}

Non sai quale ricambio ti serve? Scrivici su WhatsApp: https://wa.me/393272436497 — ti aiutiamo a trovare quello giusto per la tua auto o moto, prima e dopo l'acquisto.

📍 Via Civardi, 44 – Stradella (PV)`;

export const TELEGRAM_CAPTION_HTML = `🚗 <b>Il nuovo sito Antoniotti Autoricambi è online!</b>

${intro}

• Cerca per targa e scegli cosa ti serve: il messaggio WhatsApp si scrive da solo
• Nuove collezioni: olio motore, freni, lampadine e fari LED, tagliando, accessori inverno e moto
• Più di 300 prodotti: prezzo e disponibilità ti vengono confermati su WhatsApp dopo la verifica della targa

Non sai quale ricambio ti serve? Scrivici: ti accompagniamo dalla scelta al post vendita.

👉 ${SITE_DOMAIN}`;

export const TELEGRAM_BUTTONS = [
  { text: "Scopri il nuovo sito", url: SITE_URL },
  { text: "Scrivici su WhatsApp", url: "https://wa.me/393272436497" },
];
