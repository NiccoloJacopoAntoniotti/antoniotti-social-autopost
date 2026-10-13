// Il negozio è una vetrina (niente ordini reali, si vende via WhatsApp), quindi
// non esiste un concetto di "best seller" derivabile dagli ordini. I contenuti
// vengono invece pescati dalle collezioni "in evidenza" del catalogo, che hanno
// già foto prodotto reali e legittime (sono le foto usate per vendere quei
// prodotti sul sito stesso).

const API_VERSION = "2024-10";

// Collezione "jolly": per aggiungere contenuti al bot senza doverli legare a
// un brand specifico, basta creare/spuntare il prodotto qui — anche in
// stato "Bozza" (non visibile sul sito, ma letto comunque dall'Admin API).
// È l'unica collezione esentata dal cooldown di 7 giorni tra due post della
// stessa collezione (vedi history.js), perché al suo interno è già varia.
export const JOLLY_COLLECTION_HANDLE = "social-in-evidenza";

// Handle delle collezioni da cui pescare i prodotti. Aggiungerne/togliere qui
// per cambiare cosa può essere pubblicato, senza toccare il resto del codice.
// Ordine = priorità di assegnazione: un prodotto presente in più collezioni
// viene attribuito alla prima che lo contiene (quindi le collezioni
// specifiche stanno prima di quelle "contenitore" come accessori-moto).
// Collezioni del nuovo sito (ott 2026): vedi antoniotti-autoricambi.com/collections
const FEATURED_COLLECTION_HANDLES = [
  // nuove collezioni del sito
  "sistema-frenante",
  "tagliando-olio-filtri",
  "sospensioni-sterzo",
  "olio-motore",
  "lampadine-fari-led",
  "sistemi-xenon-e-sensori-di-parcheggio",
  "candele-batterie-lampadine",
  "riparazioni-additivi-emergenza",
  "pulizia-interni-vetri",
  "pulizia-cerchi-pneumatici",
  "lavaggio-protezione-carrozzeria",
  "pulizia-climatizzatore-abitacolo",
  "accessori-inverno-liquidi-auto",
  "barre-portatutto",
  "bauli-da-tetto",
  "portabici-peruzzo",
  "terminali-di-scarico-e-distanziali",
  "pomelli-cambio-lampa",
  "interfoni-moto",
  "abbigliamento-moto-estate",
  "abbigliamento-moto-inverno",
  "oli-additivi-e-cura-moto",
  "caschi-da-moto",
  // collezioni-marca storiche
  "bardahl-olio-e-trattamenti-motore",
  "ceramic-power-liquid",
  "copriauto-antigrandine-co-ra",
  "copricerchi",
  "lampade-fari-auto-led-xenon-le-migliori-marche-per-la-tua-auto",
  "optiline",
  "peruzzo",
  "tergicristallo-bosh",
  // contenitore generico moto (ultima: i prodotti già attribuiti sopra non si ripetono)
  "accessori-moto",
  JOLLY_COLLECTION_HANDLE,
];

function shopifyUrl(path) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN; // es: antoniotti-autoricambi.myshopify.com
  return `https://${domain}/admin/api/${API_VERSION}/${path}`;
}

async function shopifyFetch(path) {
  const res = await fetch(shopifyUrl(path), {
    headers: {
      "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Shopify API error ${res.status} su ${path}: ${await res.text()}`);
  }
  return res.json();
}

// Toglie i tag HTML dalla descrizione prodotto (Shopify la salva come rich
// text) e la accorcia: serve solo a dare fatti veri alla generazione della
// caption, non deve diventare un prompt enorme.
function plainDescription(bodyHtml) {
  if (!bodyHtml) return "";
  const text = bodyHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 600 ? text.slice(0, 600) + "…" : text;
}

async function findCollectionIdsByHandle(handles) {
  const wanted = new Set(handles);
  const found = new Map();

  for (const kind of ["custom_collections", "smart_collections"]) {
    const data = await shopifyFetch(`${kind}.json?limit=250&fields=id,handle`);
    for (const collection of data[kind] ?? []) {
      if (wanted.has(collection.handle)) found.set(collection.handle, collection.id);
    }
  }
  return found;
}

export async function getFeaturedCollectionProducts({ limit = 250 } = {}) {
  const idsByHandle = await findCollectionIdsByHandle(FEATURED_COLLECTION_HANDLES);

  const products = [];
  const seenIds = new Set();
  // Si scorre nell'ordine di FEATURED_COLLECTION_HANDLES (non in quello in cui
  // Shopify restituisce le collezioni), così l'attribuzione è prevedibile.
  for (const handle of FEATURED_COLLECTION_HANDLES) {
    const collectionId = idsByHandle.get(handle);
    if (!collectionId) continue;
    const data = await shopifyFetch(
      `collections/${collectionId}/products.json?limit=${limit}&status=any&fields=id,title,handle,images,variants,tags,body_html,status`
    );
    for (const product of data.products ?? []) {
      if (!product.images?.length) continue; // niente immagine, niente post
      // Mai prodotti archiviati (es. marchi che il negozio non tiene più) e, fuori
      // dalla collezione jolly (dove le bozze sono volute), solo prodotti
      // attivi cioè davvero visibili sul sito.
      if (product.status === "archived") continue;
      if (handle !== JOLLY_COLLECTION_HANDLE && product.status !== "active") continue;
      if (seenIds.has(product.id)) continue;
      seenIds.add(product.id);
      products.push({
        id: product.id,
        title: product.title,
        handle: product.handle,
        price: product.variants?.[0]?.price,
        imageUrl: product.images[0].src,
        productUrl: `https://${process.env.SHOPIFY_PUBLIC_DOMAIN}/products/${product.handle}`,
        collectionHandle: handle,
        tags: (product.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
        description: plainDescription(product.body_html),
      });
    }
  }
  return products;
}
