import { toPng } from "html-to-image";

const MIN_BASE64_CHARS = 900;
/** After base64 decode, expect at least this many bytes for a real chart PNG. */
const MIN_DECODED_BYTES = 2_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Heuristic: sample canvas pixels — all-white / near-blank PNGs fail (failed html-to-image).
 */
async function validateChartPngDataUrl(dataUrl: string): Promise<boolean> {
  if (dataUrl.length < MIN_BASE64_CHARS) return false;
  try {
    const img = new Image();
    img.decoding = "async";
    const loaded = new Promise<boolean>((resolve, reject) => {
      img.onload = () => resolve(true);
      img.onerror = () => reject(new Error("img"));
    });
    img.src = dataUrl;
    await loaded;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w < 64 || h < 64) return false;

    const canvas = document.createElement("canvas");
    const step = 6;
    const cw = Math.min(120, w);
    const ch = Math.min(120, h);
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, w, h, 0, 0, cw, ch);
    const data = ctx.getImageData(0, 0, cw, ch).data;
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 8) continue;
      const gray = (r + g + b) / 3;
      sum += gray;
      sumSq += gray * gray;
      n++;
    }
    if (n < 20) return false;
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    /** Blank canvas: all ~255 white, very low variance. Real charts have edges/colors. */
    if (mean > 252 && variance < 12) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Capture a DOM subtree as PNG base64 (no data URL prefix). For chart cards only.
 * Returns null if capture fails or image looks blank/invalid.
 */
export async function captureElementToPngBase64(el: HTMLElement | null): Promise<string | null> {
  if (!el) return null;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await sleep(120);
  try {
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });
    const comma = dataUrl.indexOf(",");
    if (comma === -1) return null;
    const b64 = dataUrl.slice(comma + 1);
    if (b64.length * 0.75 < MIN_DECODED_BYTES) return null;
    const ok = await validateChartPngDataUrl(dataUrl);
    if (!ok) return null;
    return b64;
  } catch {
    return null;
  }
}
