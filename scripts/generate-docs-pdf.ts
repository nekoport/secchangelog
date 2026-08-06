// Generate combined PDF documentation from all docs/*.md files
// Run: bun run scripts/generate-docs-pdf.ts

import fs from "fs/promises";
import path from "path";
import { patchPdfKitFontLoading } from "../src/lib/security/pdfkit-patch";

patchPdfKitFontLoading();

const PDFDocument = (await import("pdfkit")).default;

const docsDir = path.join(process.cwd(), "docs");
const outputFile = path.join(process.cwd(), "download", "SecChangeLog-Documentation.pdf");

interface DocFile {
  filename: string;
  title: string;
  content: string;
}

async function loadDocs(): Promise<DocFile[]> {
  const files = (await fs.readdir(docsDir)).filter(
    (f) => f.endsWith(".md") && !f.includes("audit-report")
  );
  files.sort();

  const docs: DocFile[] = [];
  for (const file of files) {
    const content = await fs.readFile(path.join(docsDir, file), "utf-8");
    // Extract title from first H1
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : file.replace(/\.md$/, "");
    docs.push({ filename: file, title, content });
  }
  return docs;
}

function renderMarkdownToPdf(doc: PDFKit.PDFDocument, md: string, systemName: string) {
  const lines = md.split("\n");
  const pageWidth = doc.page.width - 100;
  let inCodeBlock = false;
  let inTable = false;
  let tableRows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        doc.fillColor("#000");
        doc.moveDown(0.3);
      } else {
        inCodeBlock = true;
        doc.fillColor("#555");
      }
      continue;
    }
    if (inCodeBlock) {
      doc.font("Courier").fontSize(8).text(line, 50, doc.y, {
        width: pageWidth,
        lineGap: 2,
      });
      continue;
    }

    // Tables (basic support)
    if (line.startsWith("|") && line.endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      // Skip separator row
      if (!cells.every((c) => /^[-:\s]+$/.test(c))) {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      // Render table
      inTable = false;
      if (tableRows.length > 0) {
        const colCount = tableRows[0].length;
        const colWidth = pageWidth / colCount;
        for (let r = 0; r < tableRows.length; r++) {
          const row = tableRows[r];
          for (let c = 0; c < colCount && c < row.length; c++) {
            const x = 50 + c * colWidth;
            const isHeader = r === 0;
            doc.font(isHeader ? "Helvetica-Bold" : "Helvetica")
              .fontSize(8)
              .fillColor(isHeader ? "#fff" : "#000");
            const cellHeight = 16;
            if (isHeader) {
              doc.rect(x, doc.y, colWidth, cellHeight).fill("#333");
              doc.fillColor("#fff");
            }
            doc.text(row[c], x + 4, doc.y + 3, {
              width: colWidth - 8,
              height: cellHeight - 6,
            });
            doc.y -= 0; // maintain
          }
          doc.y += 18;
        }
        doc.moveDown(0.3);
      }
    }

    // Headings
    if (line.startsWith("## ")) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#1a1a1a").text(
        line.slice(3),
        50,
        doc.y,
        { width: pageWidth }
      );
      doc.moveDown(0.2);
      continue;
    }
    if (line.startsWith("### ")) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#333").text(
        line.slice(4),
        50,
        doc.y,
        { width: pageWidth }
      );
      doc.moveDown(0.1);
      continue;
    }
    if (line.startsWith("# ")) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#000").text(
        line.slice(2),
        50,
        doc.y,
        { width: pageWidth }
      );
      doc.moveDown(0.3);
      continue;
    }

    // Horizontal rule
    if (line.trim() === "---") {
      doc.moveDown(0.2);
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor("#ccc").stroke();
      doc.moveDown(0.3);
      continue;
    }

    // Bullet points
    if (line.startsWith("- ") || line.startsWith("* ")) {
      doc.font("Helvetica").fontSize(9).fillColor("#000").text(
        "• " + line.slice(2),
        60,
        doc.y,
        { width: pageWidth - 10, lineGap: 2 }
      );
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      doc.font("Helvetica").fontSize(9).fillColor("#000").text(
        `${numMatch[1]}. ${numMatch[2]}`,
        60,
        doc.y,
        { width: pageWidth - 10, lineGap: 2 }
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      doc.moveDown(0.2);
      continue;
    }

    // Regular paragraph
    doc.font("Helvetica").fontSize(9).fillColor("#000").text(line, 50, doc.y, {
      width: pageWidth,
      lineGap: 3,
    });
  }
}

async function main() {
  console.log("📄 Generating documentation PDF...");

  const docs = await loadDocs();
  console.log(`Found ${docs.length} documentation files`);

  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: {
      Title: "SecChangeLog - Documentation",
      Author: "SecChangeLog",
      Subject: "Complete System Documentation",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const stream = (await import("fs")).createWriteStream(outputFile);
  doc.pipe(stream);

  // Cover Page
  doc.fillColor("#000");
  doc.fontSize(36).font("Helvetica-Bold").text("SecChangeLog", 50, 200, {
    width: doc.page.width - 100,
    align: "center",
  });
  doc.fontSize(14).font("Helvetica").fillColor("#666").text(
    "Sistem Pencatatan Perubahan Konfigurasi Cyber Security",
    50,
    260,
    { width: doc.page.width - 100, align: "center" }
  );
  doc.moveDown(2);
  doc.fontSize(11).fillColor("#666").text(
    "Complete System Documentation",
    50,
    320,
    { width: doc.page.width - 100, align: "center" }
  );
  doc.fontSize(10).text(
    `Version 1.0.0  |  Generated: ${new Date().toISOString().slice(0, 10)}`,
    50,
    360,
    { width: doc.page.width - 100, align: "center" }
  );

  // Table of Contents
  doc.addPage();
  doc.fontSize(20).font("Helvetica-Bold").fillColor("#000").text(
    "Daftar Isi",
    50,
    50
  );
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  docs.forEach((d, i) => {
    doc.text(`${i + 1}. ${d.title}`, 60, doc.y, { indent: 0 });
    doc.moveDown(0.3);
  });

  // Render each document
  for (const d of docs) {
    doc.addPage();
    doc.fontSize(9);
    doc.fillColor("#000");
    renderMarkdownToPdf(doc, d.content, "SecChangeLog");
  }

  // Final page
  doc.addPage();
  doc.fontSize(20).font("Helvetica-Bold").fillColor("#000").text(
    "Akhir Dokumentasi",
    50,
    doc.page.height / 2 - 20,
    { width: doc.page.width - 100, align: "center" }
  );
  doc.fontSize(10).font("Helvetica").fillColor("#666").text(
    "Untuk pertanyaan, hubungi tim Engineering.",
    50,
    doc.page.height / 2 + 20,
    { width: doc.page.width - 100, align: "center" }
  );

  doc.end();

  await new Promise<void>((resolve) => {
    stream.on("finish", () => resolve());
  });

  const stats = await fs.stat(outputFile);
  console.log(`✅ Documentation PDF generated: ${outputFile}`);
  console.log(`   Size: ${(stats.size / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
