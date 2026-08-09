import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFileSync, mkdirSync } from "node:fs";

/** Generates a clean digital invoice PDF for pipeline testing. */
async function main() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const lines: Array<[string, number, typeof font]> = [
    ["INVOICE", 780, bold],
    ["Acme Cloud Services Inc.", 750, bold],
    ["invoice@acmecloud.example  |  acmecloud.example", 735, font],
    ["Invoice number: INV-2041", 700, font],
    ["Invoice date: 2026-07-28", 685, font],
    ["Bill to: Zamp Finance Pvt Ltd, Bengaluru, India", 670, font],
    ["Description                              Qty     Unit       Amount", 620, bold],
    ["Cloud hosting (July 2026)                 1     $420.00    $420.00", 600, font],
    ["Object storage 2TB                        2      $95.00    $190.00", 585, font],
    ["Support plan - Pro                        1     $150.00    $150.00", 570, font],
    ["Subtotal:  $760.00", 520, font],
    ["Tax (10%):  $76.00", 505, font],
    ["Total due:  $836.00", 485, bold],
    ["Payment due within 30 days. Thank you for your business.", 440, font],
  ];

  for (const [text, y, f] of lines) {
    page.drawText(text, { x: 60, y, size: text === "INVOICE" ? 24 : 11, font: f });
  }

  mkdirSync("samples", { recursive: true });
  const bytes = await pdf.save();
  writeFileSync("samples/clean-digital-invoice.pdf", bytes);
  console.log("wrote samples/clean-digital-invoice.pdf");
}

main();
