import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFileSync, mkdirSync } from "node:fs";

/**
 * A digital invoice with a card number in the payment footer — exercises
 * the pre-send redaction path (decisions.md §24). Uses a published Visa
 * test number, never real cardholder data.
 */
async function main() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const lines: Array<[string, number, typeof font]> = [
    ["Riverbend Office Supplies", 780, bold],
    ["Invoice: INV-7734", 750, font],
    ["Date: 2026-06-12", 735, font],
    ["Item: Printer paper (10 reams)     Amount: $120.00", 690, font],
    ["Subtotal: $120.00", 650, font],
    ["Tax: $12.00", 635, font],
    ["Total: $132.00", 618, bold],
    ["Paid by card 4111 1111 1111 1111", 580, font],
    ["Thank you for your business.", 540, font],
  ];

  for (const [text, y, f] of lines) {
    page.drawText(text, { x: 60, y, size: 12, font: f });
  }

  mkdirSync("samples", { recursive: true });
  const bytes = await pdf.save();
  writeFileSync("samples/invoice-with-card-number.pdf", bytes);
  console.log("wrote samples/invoice-with-card-number.pdf");
}

main();
