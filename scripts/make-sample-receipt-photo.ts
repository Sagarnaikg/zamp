import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";

/**
 * Generates a phone-photo-style receipt image: slight rotation, off-white
 * paper, uneven lighting. Exercises the vision extraction path (no text
 * layer), which digital-PDF samples never reach.
 */
async function main() {
  const W = 700;
  const H = 900;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Desk background
  ctx.fillStyle = "#3a3a3c";
  ctx.fillRect(0, 0, W, H);

  // Receipt paper, slightly rotated as if photographed on a table
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.035);
  ctx.fillStyle = "#f7f5ef";
  ctx.fillRect(-250, -390, 500, 780);

  ctx.fillStyle = "#1a1a1a";
  ctx.textAlign = "center";
  ctx.font = "bold 30px Helvetica";
  ctx.fillText("BLUE BOTTLE CAFE", 0, -330);
  ctx.font = "16px Helvetica";
  ctx.fillText("221 Church Street, San Francisco", 0, -300);
  ctx.fillText("Tel: (415) 555-0199", 0, -278);

  ctx.textAlign = "left";
  ctx.font = "17px Helvetica";
  const rows: Array<[string, string]> = [
    ["Receipt #", "R-88214"],
    ["Date", "12 Mar 2026"],
    ["Server", "Dana"],
  ];
  let y = -230;
  for (const [k, v] of rows) {
    ctx.fillText(k, -210, y);
    ctx.textAlign = "right";
    ctx.fillText(v, 210, y);
    ctx.textAlign = "left";
    y += 26;
  }

  ctx.fillText("--------------------------------", -210, y + 14);
  y += 48;

  const items: Array<[string, string, string]> = [
    ["2x Cappuccino", "", "9.00"],
    ["1x Avocado Toast", "", "12.50"],
    ["1x Orange Juice", "", "6.00"],
  ];
  for (const [name, , amt] of items) {
    ctx.fillText(name, -210, y);
    ctx.textAlign = "right";
    ctx.fillText(amt, 210, y);
    ctx.textAlign = "left";
    y += 28;
  }

  ctx.fillText("--------------------------------", -210, y + 6);
  y += 44;
  ctx.fillText("Subtotal", -210, y);
  ctx.textAlign = "right";
  ctx.fillText("27.50", 210, y);
  ctx.textAlign = "left";
  y += 28;
  ctx.fillText("Sales Tax (8.5%)", -210, y);
  ctx.textAlign = "right";
  ctx.fillText("2.34", 210, y);
  ctx.textAlign = "left";
  y += 34;
  ctx.font = "bold 21px Helvetica";
  ctx.fillText("TOTAL", -210, y);
  ctx.textAlign = "right";
  ctx.fillText("$29.84", 210, y);
  ctx.textAlign = "left";
  y += 44;
  ctx.font = "16px Helvetica";
  ctx.fillText("Paid by VISA ****4417", -210, y);
  y += 24;
  ctx.fillText("Thank you for visiting!", -210, y);

  ctx.restore();

  // Uneven lighting, as in a real phone photo
  const glare = ctx.createLinearGradient(0, 0, W, H);
  glare.addColorStop(0, "rgba(255,255,255,0.16)");
  glare.addColorStop(0.5, "rgba(255,255,255,0)");
  glare.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = glare;
  ctx.fillRect(0, 0, W, H);

  mkdirSync("samples", { recursive: true });
  writeFileSync("samples/receipt-photo.jpg", canvas.toBuffer("image/jpeg", 82));
  console.log("wrote samples/receipt-photo.jpg");
}

main();
