import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

// Grafica dei post e delle storie quotidiane, nello stile del nuovo sito
// (scuro, titoli molto marcati, azzurro/rosa, pulsante WhatsApp verde). I
// template sono HTML/CSS resi con Chrome: il prodotto è sempre intero (mai
// deformato né tagliato), il titolo è accorciato e al massimo su due righe,
// l'invito all'azione è uno solo e grande. Se qualcosa non funziona
// (Chrome assente, font non raggiungibili, foto rotta) chi chiama ripiega sui
// generatori storici in storyImage.js: un post non salta mai per la grafica.

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

function chromePath() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome non trovato: uso il generatore grafico di riserva.");
  return found;
}

const COLLECTION_LABELS = {
  "sistema-frenante": "Sistema frenante",
  "tagliando-olio-filtri": "Tagliando: olio e filtri",
  "sospensioni-sterzo": "Sospensioni e sterzo",
  "olio-motore": "Olio motore",
  "lampadine-fari-led": "Lampadine e fari LED",
  "sistemi-xenon-e-sensori-di-parcheggio": "Xenon e sensori di parcheggio",
  "candele-batterie-lampadine": "Candele, batterie e lampadine",
  "riparazioni-additivi-emergenza": "Riparazioni e additivi",
  "pulizia-interni-vetri": "Pulizia interni e vetri",
  "pulizia-cerchi-pneumatici": "Cerchi e pneumatici",
  "lavaggio-protezione-carrozzeria": "Lavaggio e protezione",
  "pulizia-climatizzatore-abitacolo": "Climatizzatore e abitacolo",
  "accessori-inverno-liquidi-auto": "Accessori inverno",
  "barre-portatutto": "Barre portatutto",
  "bauli-da-tetto": "Bauli da tetto",
  "portabici-peruzzo": "Portabici",
  "terminali-di-scarico-e-distanziali": "Terminali e distanziali",
  "pomelli-cambio-lampa": "Pomelli cambio",
  "interfoni-moto": "Interfoni moto",
  "abbigliamento-moto-estate": "Abbigliamento moto",
  "abbigliamento-moto-inverno": "Abbigliamento moto",
  "oli-additivi-e-cura-moto": "Cura della moto",
  "caschi-da-moto": "Caschi da moto",
  "bardahl-olio-e-trattamenti-motore": "Bardahl",
  "ceramic-power-liquid": "Ceramic Power Liquid",
  "copriauto-antigrandine-co-ra": "Copriauto antigrandine",
  "copricerchi": "Copricerchi",
  "lampade-fari-auto-led-xenon-le-migliori-marche-per-la-tua-auto": "Fari LED e xeno",
  "optiline": "Optiline",
  "peruzzo": "Peruzzo",
  "tergicristallo-bosh": "Tergicristalli Bosch",
  "accessori-moto": "Accessori moto",
};

export function collectionLabel(handle) {
  return COLLECTION_LABELS[handle] ?? "Dal nostro catalogo";
}

const SMALL_WORDS = new Set(["da", "di", "e", "per", "con", "il", "la", "lo", "le", "gli", "un", "una", "a", "in", "su"]);

// I titoli Shopify sono spesso lunghissimi e pieni di codici ("BARDAHL B2 -
// 1001I - Additivo per olio"): in grafica servono nome del prodotto, breve,
// su al massimo due righe.
export function shortTitle(title) {
  let t = String(title).replace(/\s+/g, " ").trim();
  const parts = t.split(/\s[-–|]\s/);
  t = parts[0];
  if (t.length < 14 && parts[1]) t = `${parts[0]} ${parts[1]}`;
  t = t.replace(/\s{2,}/g, " ").trim();
  if (t.length > 44) t = t.replace(/\s*\([^)]*\)\s*$/, "").trim(); // "(500 ml)" in coda: utile ma non in grafica
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length > 8 && letters === letters.toUpperCase()) {
    t = t
      .split(" ")
      .map((w, i) => {
        if (/[\d']/.test(w) || (w.length <= 3 && i > 0 && !SMALL_WORDS.has(w.toLowerCase()))) return w;
        const lower = w.toLowerCase();
        if (i > 0 && SMALL_WORDS.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(" ");
  }
  if (t.length > 66) t = t.slice(0, 63).replace(/\s+\S*$/, "") + "…";
  return t;
}

const WA_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const baseCss = (h) => `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:${h}px;overflow:hidden}
body{font-family:'Inter',-apple-system,'Helvetica Neue',Arial,sans-serif;color:#fff;position:relative;-webkit-font-smoothing:antialiased;
  background:radial-gradient(900px 720px at 10% -6%,rgba(59,102,255,.42),transparent 62%),radial-gradient(820px 680px at 108% 104%,rgba(229,39,63,.32),transparent 60%),linear-gradient(180deg,#080c17,#050811)}
body::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(180deg,#000,transparent 85%)}
.abs{position:absolute}
.logo{width:112px;height:112px;border-radius:28px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 40px rgba(0,0,0,.45);overflow:hidden}
.logo img{width:100%;height:100%;object-fit:contain;padding:6px}
.eyebrow{font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#8fb0ff;display:flex;align-items:center;gap:16px;white-space:nowrap}
.eyebrow::before{content:"";width:44px;height:3px;background:#8fb0ff;border-radius:2px;flex:0 0 auto}
.stage{background:#fff;box-shadow:0 40px 90px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;overflow:hidden}
.stage img{display:block;object-fit:contain}
.title{font-weight:900;letter-spacing:-.04em;line-height:1.02;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.cta{display:flex;align-items:center;justify-content:center;gap:20px;border-radius:999px;background:#25d366;color:#04210f;font-weight:900;letter-spacing:-.02em;box-shadow:0 22px 50px rgba(37,211,102,.30);white-space:nowrap}
.cta svg{flex:0 0 auto}
.dom{font-weight:700;letter-spacing:.02em;color:#8ea0c4;text-align:center}
`;

const wrap = (h, inner) =>
  `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>${baseCss(h)}</style></head><body>${inner}</body></html>`;

function feedHtml({ imageUrl, title, label, logoDataUri, whatsappNumber, siteDomain }) {
  return wrap(1350, `
    <div class="abs logo" style="left:72px;top:64px"><img src="${logoDataUri}"></div>
    <div class="abs eyebrow" style="left:212px;top:106px;font-size:26px">${esc(label)}</div>
    <div class="abs stage" style="left:72px;top:210px;width:936px;height:610px;border-radius:44px"><img id="prod" src="${esc(imageUrl)}" style="max-width:100%;max-height:100%"></div>
    <div class="abs" style="left:72px;top:846px;width:936px;height:150px;display:flex;align-items:center"><div class="title" style="font-size:${title.length <= 34 ? 68 : 58}px">${esc(title)}</div></div>
    <div class="abs cta" style="left:72px;top:1030px;width:936px;height:124px;font-size:44px"><div style="width:58px;height:58px">${WA_ICON}</div>Scrivici su WhatsApp</div>
    <div class="abs dom" style="left:72px;top:1190px;width:936px;font-size:32px;color:#cdd8ee">${esc(whatsappNumber)}</div>
    <div class="abs dom" style="left:72px;top:1250px;width:936px;font-size:28px">${esc(siteDomain)}</div>
  `);
}

function storyHtml({ imageUrl, title, label, logoDataUri, whatsappNumber, siteDomain }) {
  // Titolo più corto = più grande. Mai troncato con "…" se non è davvero lunghissimo.
  const size = title.length <= 30 ? 104 : title.length <= 48 ? 88 : 72;
  return wrap(1920, `
    <div class="abs logo" style="left:72px;top:262px"><img src="${logoDataUri}"></div>
    <div class="abs eyebrow" style="left:212px;top:306px;font-size:28px">${esc(label)}</div>
    <div class="abs" style="left:72px;top:420px;width:936px;height:300px;display:flex;align-items:flex-end"><div class="title" style="font-size:${size}px;-webkit-line-clamp:3">${esc(title)}</div></div>
    <div class="abs stage" style="left:90px;top:760px;width:900px;height:650px;border-radius:52px"><img id="prod" src="${esc(imageUrl)}" style="max-width:100%;max-height:100%"></div>
    <div class="abs cta" style="left:72px;top:1470px;width:936px;height:132px;font-size:48px"><div style="width:62px;height:62px">${WA_ICON}</div>Scrivici su WhatsApp</div>
    <div class="abs dom" style="left:72px;top:1626px;width:936px;font-size:36px;color:#cdd8ee">${esc(whatsappNumber)}  ·  ${esc(siteDomain)}</div>
  `);
}

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: chromePath(),
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
  }
  return browserPromise;
}

export async function closeCardBrowser() {
  if (!browserPromise) return;
  try { (await browserPromise).close(); } catch { /* già chiuso */ }
  browserPromise = null;
}

async function render(html, height) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1080, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);
    // La foto prodotto deve essersi caricata davvero: altrimenti meglio
    // rinunciare alla grafica (ripiego) che pubblicare un riquadro vuoto.
    const imgOk = await page.evaluate(
      () => new Promise((resolve) => {
        const img = document.getElementById("prod");
        const done = () => resolve(img.complete && img.naturalWidth > 0 ? { w: img.naturalWidth, h: img.naturalHeight } : null);
        if (img.complete) done(); else { img.onload = done; img.onerror = done; }
      })
    );
    if (!imgOk) throw new Error("Foto prodotto non caricata nella grafica.");
    // Foto piccole non vanno ingrandite fino a sfocarsi: si limita lo
    // zoom a 2,2x la dimensione reale (resta nitida, centrata nel riquadro).
    await page.evaluate((nat) => {
      const img = document.getElementById("prod");
      img.style.maxWidth = Math.round(nat.w * 2.2) + "px";
      img.style.maxHeight = Math.round(nat.h * 2.2) + "px";
      img.style.width = "100%";
      img.style.height = "100%";
    }, imgOk);
    await new Promise((r) => setTimeout(r, 250));
    return await page.screenshot({ type: "jpeg", quality: 92 });
  } finally {
    await page.close();
  }
}

async function logoDataUri(logoPath) {
  const buf = await readFile(logoPath);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

export async function renderFeedCard({ imageUrl, title, collectionHandle, whatsappNumber, siteDomain, logoPath }) {
  const html = feedHtml({
    imageUrl,
    title: shortTitle(title),
    label: collectionLabel(collectionHandle),
    logoDataUri: await logoDataUri(logoPath),
    whatsappNumber,
    siteDomain,
  });
  return render(html, 1350);
}

export async function renderStoryCard({ imageUrl, title, collectionHandle, whatsappNumber, siteDomain, logoPath }) {
  const html = storyHtml({
    imageUrl,
    title: shortTitle(title),
    label: collectionLabel(collectionHandle),
    logoDataUri: await logoDataUri(logoPath),
    whatsappNumber,
    siteDomain,
  });
  return render(html, 1920);
}
