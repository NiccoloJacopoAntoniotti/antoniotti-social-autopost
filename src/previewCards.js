import { getFeaturedCollectionProducts } from "./shopify.js";
import { renderFeedCard, renderStoryCard, closeCardBrowser, shortTitle } from "./cards.js";
import { mkdir, writeFile } from "node:fs/promises";

// Anteprima delle fonti e della grafica SENZA pubblicare nulla e senza
// toccare lo storico: legge il catalogo con la stessa funzione del bot,
// riepiloga quanti prodotti pubblicabili ci sono per collezione e disegna
// feed + storia per qualche prodotto a caso di collezioni diverse. I file
// finiscono in preview-out/ (il workflow li carica come allegato).
const OUT = new URL("../preview-out/", import.meta.url);
const COUNT = Number(process.env.PREVIEW_COUNT ?? 4);

function formatWhatsappNumber(raw) {
  const match = raw.match(/^39(\d{3})(\d{3})(\d{4})$/);
  return match ? `+39 ${match[1]} ${match[2]} ${match[3]}` : `+${raw}`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const products = await getFeaturedCollectionProducts();

  const perCollection = {};
  for (const p of products) perCollection[p.collectionHandle] = (perCollection[p.collectionHandle] ?? 0) + 1;
  const summary = Object.entries(perCollection).sort((a, b) => b[1] - a[1]).map(([h, n]) => `${String(n).padStart(3)}  ${h}`).join("\n");
  console.log(`Prodotti pubblicabili: ${products.length} in ${Object.keys(perCollection).length} collezioni\n${summary}`);
  await writeFile(new URL("fonti.txt", OUT), `Prodotti pubblicabili: ${products.length}\n${summary}\n`);

  // prodotti a caso, da collezioni diverse
  const byCollection = Object.keys(perCollection).sort(() => Math.random() - 0.5).slice(0, COUNT);
  const logoPath = new URL("../assets/logo.jpg", import.meta.url);
  let i = 0;
  for (const handle of byCollection) {
    const pool = products.filter((p) => p.collectionHandle === handle);
    const item = pool[Math.floor(Math.random() * pool.length)];
    const args = {
      imageUrl: item.imageUrl,
      title: item.title,
      collectionHandle: item.collectionHandle,
      whatsappNumber: formatWhatsappNumber(process.env.WHATSAPP_NUMBER),
      siteDomain: process.env.SHOPIFY_PUBLIC_DOMAIN,
      logoPath,
    };
    await writeFile(new URL(`feed-${i}.jpg`, OUT), await renderFeedCard(args));
    await writeFile(new URL(`story-${i}.jpg`, OUT), await renderStoryCard(args));
    console.log(`#${i} [${handle}] ${item.title} => "${shortTitle(item.title)}"`);
    i++;
  }
  await closeCardBrowser();
}

main().catch(async (err) => {
  console.error(err);
  await closeCardBrowser();
  process.exit(1);
});
