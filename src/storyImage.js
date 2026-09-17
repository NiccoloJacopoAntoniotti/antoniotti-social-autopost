import sharp from "sharp";
import { readFile } from "node:fs/promises";

const WIDTH = 1080;
const HEIGHT = 1920;
const LOGO_SIZE = 150;

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Spezza una stringa in più righe che stiano dentro maxChars, senza tagliare
// le parole a metà (serve perché SVG <text> non va a capo da solo).
function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildOverlaySvg({ title, whatsappLine, siteDomain }) {
  const titleLines = wrapText(title, 28).slice(0, 3);
  const bandHeight = 420 + titleLines.length * 60;
  const bandY = HEIGHT - bandHeight;

  const titleTspans = titleLines
    .map((line, i) => `<tspan x="60" dy="${i === 0 ? 0 : 60}">${escapeXml(line)}</tspan>`)
    .join("");

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0" />
          <stop offset="35%" stop-color="#0b1d33" stop-opacity="0.75" />
          <stop offset="100%" stop-color="#0b1d33" stop-opacity="0.92" />
        </linearGradient>
      </defs>
      <rect x="0" y="${bandY}" width="${WIDTH}" height="${bandHeight}" fill="url(#fade)" />
      <text x="60" y="${bandY + 90}" font-family="Arial, Helvetica, sans-serif"
        font-size="52" font-weight="700" fill="#ffffff">${titleTspans}</text>
      <text x="60" y="${bandY + 90 + titleLines.length * 60 + 70}" font-family="Arial, Helvetica, sans-serif"
        font-size="44" font-weight="700" fill="#25d366">${escapeXml(whatsappLine)}</text>
      <text x="60" y="${HEIGHT - 60}" font-family="Arial, Helvetica, sans-serif"
        font-size="32" fill="#c9d6e3">${escapeXml(siteDomain)}</text>
    </svg>
  `;
}

// Spazio riservato in basso alla fascia di testo: il prodotto non deve mai
// finirci sotto. Tenuto largo perché il titolo può occupare fino a 3 righe.
const TEXT_BAND_RESERVE = 620;

// Instagram accetta nel feed solo proporzioni tra 4:5 e 1.91:1: una foto
// prodotto molto stretta o molto allungata (es. un adattatore lungo e
// sottile) viene rifiutata a monte con un errore esplicito, non un warning.
// Il quadrato 1:1 è sempre dentro il range accettato qualunque sia la forma
// della foto originale, quindi è un fallback sicuro da usare solo quando la
// foto originale viene rifiutata (vedi index.js).
const FEED_SIZE = 1080;

export async function buildFeedImage(imageUrl) {
  const sourceRes = await fetch(imageUrl);
  if (!sourceRes.ok) throw new Error(`Impossibile scaricare l'immagine prodotto: ${sourceRes.status}`);
  const sourceBuffer = Buffer.from(await sourceRes.arrayBuffer());

  const backdrop = await sharp(sourceBuffer)
    .resize(FEED_SIZE, FEED_SIZE, { fit: "cover", position: "attention" })
    .blur(45)
    .modulate({ brightness: 0.6 })
    .toBuffer();

  const margin = 80;
  const product = await sharp(sourceBuffer)
    .resize(FEED_SIZE - margin * 2, FEED_SIZE - margin * 2, {
      fit: "inside",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();
  const productMeta = await sharp(product).metadata();
  const left = Math.round((FEED_SIZE - productMeta.width) / 2);
  const top = Math.round((FEED_SIZE - productMeta.height) / 2);

  return sharp(backdrop)
    .composite([{ input: product, left, top }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function buildStoryImage({ imageUrl, title, whatsappNumber, siteDomain, logoPath }) {
  const [sourceRes, logoBuffer] = await Promise.all([
    fetch(imageUrl),
    readFile(logoPath),
  ]);
  if (!sourceRes.ok) throw new Error(`Impossibile scaricare l'immagine prodotto: ${sourceRes.status}`);
  const sourceBuffer = Buffer.from(await sourceRes.arrayBuffer());

  // Le foto prodotto sono quasi sempre quadrate/orizzontali: forzarle a
  // riempire un riquadro 9:16 con "cover" tagliava via pezzi di prodotto in
  // modo imprevedibile. Ora il prodotto resta sempre intero (fit "inside"),
  // centrato sopra uno sfondo sfumato ricavato dalla stessa foto.
  const backdrop = await sharp(sourceBuffer)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "attention" })
    .blur(45)
    .modulate({ brightness: 0.55 })
    .toBuffer();

  const productAreaHeight = HEIGHT - TEXT_BAND_RESERVE;
  const product = await sharp(sourceBuffer)
    .resize(WIDTH - 120, productAreaHeight - 120, {
      fit: "inside",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png() // serve l'alpha per la trasparenza: il formato originale (JPEG) non la supporta
    .toBuffer();
  const productMeta = await sharp(product).metadata();
  const productLeft = Math.round((WIDTH - productMeta.width) / 2);
  const productTop = Math.round((productAreaHeight - productMeta.height) / 2);

  const background = await sharp(backdrop)
    .composite([{ input: product, left: productLeft, top: productTop }])
    .toBuffer();

  const logo = await sharp(logoBuffer)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: "cover" })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${LOGO_SIZE}" height="${LOGO_SIZE}"><circle cx="${LOGO_SIZE / 2}" cy="${LOGO_SIZE / 2}" r="${LOGO_SIZE / 2}" fill="white"/></svg>`
        ),
        blend: "dest-in",
      },
    ])
    .toBuffer();

  const overlaySvg = buildOverlaySvg({
    title,
    whatsappLine: `WhatsApp: ${whatsappNumber}`,
    siteDomain,
  });

  return sharp(background)
    .composite([
      { input: Buffer.from(overlaySvg), top: 0, left: 0 },
      // top: 260, non 60 — nei primi ~250px la storia è coperta dall'interfaccia
      // di Instagram (nome account, orario, barra di avanzamento): un logo più
      // in alto ci finisce sotto e sembra tagliato/sfasato.
      { input: logo, top: 260, left: WIDTH - LOGO_SIZE - 60 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}
