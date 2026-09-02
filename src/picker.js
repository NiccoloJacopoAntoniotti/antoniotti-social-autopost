import { getFeaturedCollectionProducts } from "./shopify.js";
import { filterRecentlyPosted, filterCollectionCooldown } from "./history.js";

// Tag da mettere sui prodotti (es. collezione "Social - In evidenza") il cui
// contenuto ha senso solo in una stagione precisa (es. "Stagionali inverno",
// "Climatizzazione"). Non è un vincolo rigido: fuori da inverno/estate non c'è
// nessuna esclusione, si pesca da tutto normalmente.
const SEASON_TAG_WINTER = "stagione-inverno";
const SEASON_TAG_SUMMER = "stagione-estate";

function isOffSeason(tags) {
  const month = new Date().getMonth() + 1; // 1-12
  if ([12, 1, 2].includes(month)) return tags.includes(SEASON_TAG_SUMMER); // inverno: niente prodotti estivi
  if ([6, 7, 8].includes(month)) return tags.includes(SEASON_TAG_WINTER); // estate: niente prodotti invernali
  return false; // primavera/autunno: nessun vincolo stagionale
}

// Sceglie il prossimo prodotto da usare per un contenuto, condiviso da tutti
// i canali (social, Telegram, newsletter): ognuno passa il proprio storico,
// così ogni canale ha la propria rotazione senza pescare per forza lo stesso
// prodotto usato da un altro canale lo stesso giorno.
export async function pickNextItem(history) {
  const products = (await getFeaturedCollectionProducts({ limit: 10 }))
    .filter((p) => !isOffSeason(p.tags))
    .map((p) => ({
      kind: "product",
      key: `product:${p.id}`,
      title: p.title,
      price: p.price,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      collectionHandle: p.collectionHandle,
    }));

  const fresh = filterRecentlyPosted(history, products, (c) => c.key);

  // Tra i prodotti "freschi", evita di ripescare una collezione-marca già
  // usata negli ultimi 7 giorni (la jolly fa eccezione, è varia di suo). Se
  // questo vincolo lascia la ciotola vuota, meglio ignorarlo che saltare il
  // post: si allenta prima il vincolo sulla collezione, poi come ultima
  // spiaggia si ripete un prodotto già postato.
  const freshAndRotated = filterCollectionCooldown(history, fresh);
  if (freshAndRotated.length > 0) return freshAndRotated[Math.floor(Math.random() * freshAndRotated.length)];
  if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)];

  // tutto già postato di recente: meglio ripetere un prodotto che saltare il post
  return products[0] ?? null;
}
