import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";

/**
 * A deliberately hard sample: low-contrast faded thermal print, scan noise,
 * and digits chosen to be genuinely ambiguous (8/6, 3/8). Exercises the
 * path where two readings disagree and the focused tiebreaker has to settle
 * it — the case clean samples never reach.
 */
async function main() {
  const W = 560;
  const H = 760;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#efece4";
  ctx.fillRect(0, 0, W, H);

  // Faded, low-contrast ink — the defining property of old thermal receipts.
  const ink = "rgba(90,88,86,0.62)";
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.font = "bold 24px Helvetica";
  ctx.fillText("NORTHGATE HARDWARE", W / 2, 70);
  ctx.font = "14px Helvetica";
  ctx.fillText("88 Mill Road  ·  Invoice", W / 2, 95);

  ctx.textAlign = "left";
  ctx.font = "15px Helvetica";
  let y = 145;
  const line = (label: string, value: string) => {
    ctx.fillText(label, 55, y);
    ctx.textAlign = "right";
    ctx.fillText(value, W - 55, y);
    ctx.textAlign = "left";
    y += 30;
  };

  line("Invoice No", "NG-88361");
  line("Date", "09/03/2026");
  line("PO No", "PO-55810");
  y += 12;

  line("Cordless drill", "188.00");
  line("Drill bit set x3", "63.00");
  line("Safety goggles", "38.00");
  y += 12;

  line("Subtotal", "289.00");
  line("VAT 20%", "57.80");
  ctx.font = "bold 17px Helvetica";
  line("Total", "346.80");

  // Scan noise and horizontal banding — the usual thermal-scan artifacts.
  const image = ctx.getImageData(0, 0, W, H);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const noise = (Math.random() - 0.5) * 46;
    px[i] = Math.max(0, Math.min(255, px[i] + noise));
    px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + noise));
    px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + noise));
  }
  ctx.putImageData(image, 0, 0);

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let band = 0; band < H; band += 7) {
    ctx.fillRect(0, band, W, 2);
  }

  mkdirSync("samples", { recursive: true });
  writeFileSync("samples/faded-scan-invoice.jpg", canvas.toBuffer("image/jpeg", 55));
  console.log("wrote samples/faded-scan-invoice.jpg");
}

main();
