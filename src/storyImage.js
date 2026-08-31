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

export async function buildStoryImage({ imageUrl, title, whatsappNumber, siteDomain, logoPath }) {
  const [sourceRes, logoBuffer] = await Promise.all([
    fetch(imageUrl),
    readFile(logoPath),
  ]);
  if (!sourceRes.ok) throw new Error(`Impossibile scaricare l'immagine prodotto: ${sourceRes.status}`);
  const sourceBuffer = Buffer.from(await sourceRes.arrayBuffer());

  const background = await sharp(sourceBuffer)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "attention" })
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
      { input: logo, top: 60, left: WIDTH - LOGO_SIZE - 60 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}
