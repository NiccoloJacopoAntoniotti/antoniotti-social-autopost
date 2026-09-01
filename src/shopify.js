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
const FEATURED_COLLECTION_HANDLES = [
  "bardahl-olio-e-trattamenti-motore",
  "caschi-da-moto",
  "ceramic-power-liquid",
  "copriauto-antigrandine-co-ra",
  "copricerchi",
  "lampade-fari-auto-led-xenon-le-migliori-marche-per-la-tua-auto",
  "optiline",
  "peruzzo",
  "tergicristallo-bosh",
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

export async function getFeaturedCollectionProducts({ limit = 10 } = {}) {
  const idsByHandle = await findCollectionIdsByHandle(FEATURED_COLLECTION_HANDLES);

  const products = [];
  for (const [handle, collectionId] of idsByHandle) {
    const data = await shopifyFetch(
      `collections/${collectionId}/products.json?limit=${limit}&status=any&fields=id,title,handle,images,variants,tags`
    );
    for (const product of data.products ?? []) {
      if (!product.images?.length) continue; // niente immagine, niente post
      products.push({
        id: product.id,
        title: product.title,
        handle: product.handle,
        price: product.variants?.[0]?.price,
        imageUrl: product.images[0].src,
        productUrl: `https://${process.env.SHOPIFY_PUBLIC_DOMAIN}/products/${product.handle}`,
        collectionHandle: handle,
        tags: (product.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      });
    }
  }
  return products;
}
