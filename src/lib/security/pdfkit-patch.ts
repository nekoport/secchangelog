// Workaround for PDFKit's __dirname resolution issue in Next.js standalone builds.
// PDFKit uses __dirname + '/data/Helvetica.afm' which resolves to /ROOT/...
// in standalone builds. This module patches fs.readFileSync to redirect those
// reads to the actual location under process.cwd()/node_modules/pdfkit/js/data/.

import fs from "fs";
import path from "path";

let patched = false;

export function patchPdfKitFontLoading() {
  if (patched) return;
  patched = true;

  const originalReadFileSync = fs.readFileSync;

  function patchedReadFileSync(file: string, options?: any): any {
    // Redirect pdfkit data reads
    if (typeof file === "string" && file.includes("pdfkit/js/data/")) {
      // Extract relative path from "pdfkit/js/data/..."
      const match = file.match(/pdfkit\/js\/data\/(.+)$/);
      if (match) {
        const filename = match[1];
        const candidates = [
          path.join(process.cwd(), "node_modules/pdfkit/js/data", filename),
          path.join(process.cwd(), ".pdfkit-data", filename),
        ];
        for (const candidate of candidates) {
          try {
            return originalReadFileSync(candidate, options);
          } catch {
            // try next
          }
        }
      }
    }
    return originalReadFileSync(file, options);
  }

  // Patch both fs and fs.promises if needed
  fs.readFileSync = patchedReadFileSync as typeof fs.readFileSync;
}
