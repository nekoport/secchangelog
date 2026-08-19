import { db } from "@/lib/db";
import type { ChangeLog } from "@prisma/client";
import { AuditTrailService } from "./audit-trail.service";

interface ExportFilters {
  search?: string;
  deviceTypeId?: string;
  riskLevel?: string;
  picId?: string;
  changeType?: string;
  from?: Date;
  to?: Date;
  includeDeleted?: boolean;
}

function getImageSize(buf: Buffer): { width: number; height: number } {
  // PNG (signature 0x89 PNG; IHDR width/height at byte 16/20)
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG (SOF markers C0-CF, excluding C4/C8/CC)
  if (buf.length > 4 && buf.readUInt16BE(0) === 0xffd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          width: buf.readUInt16BE(i + 7),
          height: buf.readUInt16BE(i + 5),
        };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  // WebP (RIFF....WEBP; scan VP8 / VP8L / VP8X chunks)
  if (
    buf.length > 20 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    let off = 12;
    while (off + 8 <= buf.length) {
      const tag = buf.toString("ascii", off, off + 4);
      const size = buf.readUInt32LE(off + 4);
      const dataStart = off + 8;
      if (dataStart + size > buf.length) break;
      if (tag === "VP8X") {
        // 1 byte flags + 3 reserved + 3-byte (width-1) + 3-byte (height-1)
        return {
          width: buf.readUIntLE(dataStart + 4, 3) + 1,
          height: buf.readUIntLE(dataStart + 7, 3) + 1,
        };
      }
      if (tag === "VP8L") {
        // 1 byte signature(0x2f) + bit-packed 14-bit (width-1)/(height-1)
        const b1 = buf[dataStart + 1];
        const b2 = buf[dataStart + 2];
        const b3 = buf[dataStart + 3];
        const b4 = buf[dataStart + 4];
        const width = ((b1 | (b2 << 8) | (b3 << 16)) & 0x3fff) + 1;
        const height = (((b1 >> 14) | (b2 << 2) | (b3 << 10) | (b4 << 18)) & 0x3fff) + 1;
        return { width, height };
      }
      if (tag === "VP8 ") {
        // 3-byte frame tag + 3-byte start code + 2-byte width + 2-byte height
        return {
          width: buf.readUInt16LE(dataStart + 6),
          height: buf.readUInt16LE(dataStart + 8),
        };
      }
      // skip child chunks (odd length chunks are padded to even)
      off += 8 + size + (size % 2);
    }
  }
  throw new Error("UNSUPPORTED_IMAGE");
}

// Decode an uploaded screenshot into a buffer pdfkit can embed (JPEG/PNG) with
// known dimensions. WebP is re-encoded to PNG via sharp so it can be embedded.
async function loadImageForPdf(
  buf: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  try {
    if (mimeType === "image/png" || mimeType === "image/jpeg") {
      const { width, height } = getImageSize(buf);
      return { buffer: buf, width, height };
    }
    if (mimeType === "image/webp") {
      const sharp = (await import("sharp")).default;
      const pngBuf = await sharp(buf).rotate().png().toBuffer();
      const { width, height } = getImageSize(pngBuf);
      return { buffer: pngBuf, width, height };
    }
    return null;
  } catch {
    return null;
  }
}

// WIB = UTC+7 (fixed offset, no DST)
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Convert a Date to WIB wall-clock parts using UTC getters after shifting the offset.
function wibParts(d: Date) {
  const w = new Date(d.getTime() + WIB_OFFSET_MS);
  return {
    year: w.getUTCFullYear(),
    month: w.getUTCMonth(),
    day: w.getUTCDate(),
    hours: w.getUTCHours(),
    minutes: w.getUTCMinutes(),
    seconds: w.getUTCSeconds(),
  };
}

// e.g. "2026-08-10 14:09:13 WIB"
function formatWibDateTime(d: Date): string {
  const p = wibParts(d);
  return `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)} ${pad2(p.hours)}:${pad2(p.minutes)}:${pad2(p.seconds)} WIB`;
}

// e.g. "05 Agustus 2026"
function formatWibDateId(d: Date): string {
  const p = wibParts(d);
  return `${pad2(p.day)} ${MONTHS_ID[p.month]} ${p.year}`;
}

export class ExportService {
  static async getFilteredChangeLogs(filters: ExportFilters) {
    const where: Record<string, unknown> = {};

    if (!filters.includeDeleted) where.isDeleted = false;

    if (filters.search) {
      where.OR = [
        { ticketId: { contains: filters.search } },
        { requestor: { contains: filters.search } },
        { deviceName: { contains: filters.search } },
        { deviceIp: { contains: filters.search } },
        { descriptionBefore: { contains: filters.search } },
        { descriptionAfter: { contains: filters.search } },
        { reason: { contains: filters.search } },
      ];
    }
    if (filters.deviceTypeId) where.deviceTypeId = filters.deviceTypeId;
    if (filters.riskLevel) where.riskLevel = filters.riskLevel;
    if (filters.picId) where.picId = filters.picId;
    if (filters.changeType) where.changeType = filters.changeType;

    if (filters.from || filters.to) {
      const dateFilter: Record<string, Date> = {};
      if (filters.from) dateFilter.gte = filters.from;
      if (filters.to) dateFilter.lte = filters.to;
      where.implementedAt = dateFilter;
    }

    return db.changeLog.findMany({
      where,
      include: {
        deviceType: { select: { name: true } },
        pic: { select: { name: true } },
        creator: { select: { name: true } },
      },
      orderBy: { implementedAt: "desc" },
    });
  }

  static async exportToExcel(
    filters: ExportFilters,
    userId: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<Buffer> {
    const XLSX = await import("@e965/xlsx");

    const items = await this.getFilteredChangeLogs(filters);

    // Sheet 1: Change Logs
    const sheet1Data = items.map((log) => ({
      "Ticket ID": log.ticketId,
      "Tanggal Implementasi": formatWibDateTime(log.implementedAt),
      "Jenis Perangkat": log.deviceType.name,
      "Nama Perangkat": log.deviceName,
      "IP Address": log.deviceIp || "",
      "Jenis Perubahan": log.changeType,
      "Pemohon": log.requestor || "",
      "PIC": log.pic.name,
      "Pencatat": log.creator.name,
      "Permintaan": log.descriptionBefore,
      "Perubahan Konfigurasi": log.descriptionAfter,
      "Keterangan": log.reason,
      "Rollback Plan": log.rollbackPlan || "",
      "Tanggal Dibuat": formatWibDateTime(log.createdAt),
    }));

    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    ws1["!cols"] = [
      { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
      { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 50 },
      { wch: 50 }, { wch: 40 }, { wch: 40 }, { wch: 20 },
    ];

    // Sheet 2: Summary
    const summaryData = [
      { Metric: "Total Change Logs", Value: items.length },
      { Metric: "", Value: "" },
      { Metric: "By Device Type", Value: "" },
      ...Object.entries(
        items.reduce((acc, i) => {
          const name = i.deviceType.name;
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([k, v]) => ({ Metric: `  ${k}`, Value: v })),
    ];
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    ws2["!cols"] = [{ wch: 30 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Change Logs");
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    await AuditTrailService.log({
      userId,
      action: "EXPORT_EXCEL",
      entityType: "ChangeLog",
      entityId: "export",
      metadata: { count: items.length, filters },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return buffer;
  }

  static async exportToPdf(
    changeLogId: string,
    userId: string,
    systemName: string,
    logoPath?: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<Buffer> {
    const PDFDocument = (await import("pdfkit")).default;
    const fs = await import("fs/promises");
    const path = await import("path");

    const log = await db.changeLog.findUnique({
      where: { id: changeLogId },
      include: {
        deviceType: { select: { name: true } },
        pic: { select: { name: true, email: true } },
        creator: { select: { name: true } },
        screenshots: true,
      },
    });

    if (!log) throw new Error("NOT_FOUND");

    return new Promise<Buffer>(async (resolve, reject) => {
      try {
      // Apply PDFKit font loading patch (workaround for standalone build __dirname issue)
      const { patchPdfKitFontLoading } = await import("@/lib/security/pdfkit-patch");
      patchPdfKitFontLoading();

      const PDFDocument = (await import("pdfkit")).default;
      const fs = await import("fs/promises");
      const path = await import("path");

      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Change Log ${log.ticketId}`,
          Author: systemName,
          Subject: "Configuration Change Report",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      const pageWidth = doc.page.width - 100;

      // Logo (if available)
      let logoOffsetX = 50;
      if (logoPath) {
        try {
          // Stored path may contain a cache-busting query (?v=...), strip it
          const logoFile = logoPath.split("?")[0];
          const logoName = logoFile.split("/").pop() || "";
          // Resolve from the uploads dir (same source as screenshots / API routes)
          const uploadBase =
            process.env.UPLOAD_DIR ||
            path.join(process.cwd(), "public", "uploads");
          const logoFullPath = path.join(uploadBase, "logos", logoName);
          const logoBuffer = await fs.readFile(logoFullPath);
          // Determine image type
          if (logoName.endsWith(".png")) {
            doc.image(logoBuffer, 50, 50, { width: 60, height: 60 });
          } else if (
            logoName.endsWith(".jpg") ||
            logoName.endsWith(".jpeg")
          ) {
            doc.image(logoBuffer, 50, 50, { width: 60, height: 60 });
          }
          // SVG not supported by pdfkit directly - skip
          logoOffsetX = 130;
        } catch {
          // ignore logo errors
        }
      }

      // Title
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(systemName, logoOffsetX, 55);
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#666")
        .text("Configuration Change Report", logoOffsetX, 80);

      doc.fillColor("#000");

      // Horizontal line
      doc
        .moveTo(50, 125)
        .lineTo(doc.page.width - 50, 125)
        .strokeColor("#ccc")
        .stroke();

      // Ticket ID - big and prominent
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1a1a1a")
        .text(`Ticket ID: ${log.ticketId}`, 50, 145);

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#666")
        .text(
          `Generated: ${formatWibDateTime(new Date())}`,
          50,
          165
        );

      doc.fillColor("#000");

      // Page-break helper: returns a y that guarantees `needed` pt of room
      // above the footer area, pushing to a fresh page when required.
      const contentBottom = () => doc.page.height - 80;
      const ensureSpace = (y: number, needed: number): number => {
        if (y + needed > contentBottom()) {
          doc.addPage();
          return 50;
        }
        return y;
      };

      // Section 1: Change Info
      let y = 200;
      y = ensureSpace(y, 34);
      y = this.drawSectionTitle(doc, "Informasi Perubahan", 50, y);
      y += 10;

      const infoRows: Array<[string, string]> = [
        ["Jenis Perangkat", log.deviceType.name],
        ["Nama Perangkat", log.deviceName],
        ["IP Address", log.deviceIp || "-"],
        ["Jenis Perubahan", log.changeType],
        ["Pemohon", log.requestor || "-"],
        ["PIC", log.pic.name],
        ["Pencatat", log.creator.name],
        ["Risk Level", log.riskLevel || "-"],
        ["Waktu Implementasi", formatWibDateId(log.implementedAt)],
      ];

      const labelW = 150;
      const valueW = pageWidth - 160;
      for (const [label, value] of infoRows) {
        y = ensureSpace(y, 22);
        // Dynamic row height: count wrapped lines so tall values never
        // overlap the row below them.
        const labelH = doc.heightOfString(label, { width: labelW });
        const valueH = doc.heightOfString(value, { width: valueW });
        const rowH = Math.max(labelH, valueH, 18) + 2;
        doc.font("Helvetica-Bold").fontSize(9).text(label, 50, y, { width: labelW });
        doc.font("Helvetica").fontSize(9).text(value, 210, y, { width: valueW });
        y += rowH;
      }

      y += 10;
      // Section 2: Description Before/After
      y = ensureSpace(y, 34);
      y = this.drawSectionTitle(doc, "Deskripsi Perubahan", 50, y);
      y += 10;

      y = ensureSpace(y, 24);
      doc.font("Helvetica-Bold").fontSize(9).text("PERMINTAAN:", 50, y);
      y += 14;
      y = ensureSpace(y, 24);
      doc.font("Helvetica").fontSize(9).text(log.descriptionBefore, 50, y, {
        width: pageWidth,
        lineGap: 4,
      });
      y = (doc.y as number) + 14;

      y = ensureSpace(y, 24);
      doc.font("Helvetica-Bold").fontSize(9).text("PERUBAHAN KONFIGURASI:", 50, y);
      y += 14;
      y = ensureSpace(y, 24);
      doc.font("Helvetica").fontSize(9).text(log.descriptionAfter, 50, y, {
        width: pageWidth,
        lineGap: 4,
      });
      y = (doc.y as number) + 14;

      // Section 3: Reason & Rollback
      y = ensureSpace(y, 34);
      y = this.drawSectionTitle(doc, "Keterangan & Rollback Plan", 50, y);
      y += 10;

      y = ensureSpace(y, 24);
      doc.font("Helvetica-Bold").fontSize(9).text("KETERANGAN:", 50, y);
      y += 14;
      y = ensureSpace(y, 24);
      doc.font("Helvetica").fontSize(9).text(log.reason, 50, y, {
        width: pageWidth,
        lineGap: 4,
      });
      y = (doc.y as number) + 14;

      y = ensureSpace(y, 24);
      doc.font("Helvetica-Bold").fontSize(9).text("ROLLBACK PLAN:", 50, y);
      y += 14;
      y = ensureSpace(y, 24);
      doc.font("Helvetica").fontSize(9).text(log.rollbackPlan || "-", 50, y, {
        width: pageWidth,
        lineGap: 4,
      });
      y = (doc.y as number) + 20;

      // Section 4: Screenshots
      if (log.screenshots.length > 0) {
        y = ensureSpace(y, 34);
        y = this.drawSectionTitle(doc, "Bukti Screenshot", 50, y);
        y += 10;

        for (const scr of log.screenshots) {
          if (scr.mimeType === "application/pdf") continue; // skip PDF screenshots

          // Resolve + measure first so page-break & Y-advance are accurate.
          let img: { buffer: Buffer; width: number; height: number } | null = null;
          let dispW: number | null = null;
          let dispH: number | null = null;
          const filePath = path.join(
            process.env.UPLOAD_DIR ||
              path.join(process.cwd(), "public", "uploads"),
            "screenshots",
            scr.filename
          );
          try {
            const raw = await fs.readFile(filePath);
            img = await loadImageForPdf(raw, scr.mimeType);
            if (img) {
              dispW = Math.min(500, pageWidth);
              dispH = (dispW * img.height) / img.width;
              if (dispH > 300) {
                dispH = 300;
                dispW = (dispH * img.width) / img.height;
              }
            }
          } catch {
            // file missing / unreadable -> placeholder below
          }

          const caption = `${scr.type} - ${scr.originalName}`;
          // Measure the actual caption height so wrapped captions don't overlap.
          const captionH = doc.heightOfString(caption, { width: pageWidth });
          const blockH = (dispH ?? 20) + captionH + 8 + 20;
          if (y + blockH > contentBottom()) {
            doc.addPage();
            y = 50;
          }

          doc.font("Helvetica-Bold").fontSize(9).text(caption, 50, y, { width: pageWidth });
          y += captionH + 8;

          if (img && dispW !== null && dispH !== null) {
            try {
              doc.image(img.buffer, 50, y, { width: dispW });
              y += dispH + 20;
            } catch {
              doc.font("Helvetica").fontSize(9).fillColor("#999").text(
                "[Gambar tidak dapat ditampilkan]",
                50,
                y
              );
              doc.fillColor("#000");
              y += 20;
            }
          } else {
            doc.font("Helvetica").fontSize(9).fillColor("#999").text(
              "[Gambar tidak dapat ditampilkan]",
              50,
              y
            );
            doc.fillColor("#000");
            y += 20;
          }
        }
      }

      // Footer with page number
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      const pageStart = range.start;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(pageStart + i);
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#999")
          .text(
            `${systemName} - ${log.ticketId} | Halaman ${i + 1} dari ${totalPages}`,
            50,
            doc.page.height - 40,
            { width: pageWidth, align: "center" }
          );
      }

      doc.end();

      await AuditTrailService.log({
        userId,
        action: "EXPORT_PDF",
        entityType: "ChangeLog",
        entityId: changeLogId,
        metadata: { ticketId: log.ticketId },
        ipAddress: requestInfo?.ipAddress,
        userAgent: requestInfo?.userAgent,
      });
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  static async exportToWord(
    changeLogId: string,
    userId: string,
    systemName: string,
    logoPath?: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<Buffer> {
    const log = await db.changeLog.findUnique({
      where: { id: changeLogId },
      include: {
        deviceType: { select: { name: true } },
        pic: { select: { name: true } },
        creator: { select: { name: true } },
        screenshots: true,
      },
    });

    if (!log) throw new Error("NOT_FOUND");

    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      HeadingLevel,
      AlignmentType,
      ImageRun,
    } = await import("docx");
    const fs = await import("fs/promises");
    const path = await import("path");

    const uploadBase =
      process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

    const children: import("docx").Paragraph[] = [];

    const labelParagraph = (label: string, value: string) =>
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `${label}: `, bold: true }),
          new TextRun(String(value)),
        ],
      });

    // Header: logo + system name
    if (logoPath) {
      try {
        const logoName = logoPath.split("?")[0].split("/").pop() || "";
        const logoFullPath = path.join(uploadBase, "logos", logoName);
        const logoBuffer = await fs.readFile(logoFullPath);
        if (logoName.endsWith(".png")) {
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: "png",
                  data: logoBuffer,
                  transformation: { width: 60, height: 60 },
                }),
              ],
            })
          );
        } else if (logoName.endsWith(".jpg") || logoName.endsWith(".jpeg")) {
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: "jpg",
                  data: logoBuffer,
                  transformation: { width: 60, height: 60 },
                }),
              ],
            })
          );
        }
      } catch {
        // ignore logo errors
      }
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: systemName, bold: true, size: 36 }),
        ],
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Configuration Change Report",
            size: 22,
            color: "666666",
          }),
        ],
        spacing: { after: 300 },
      })
    );

    children.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({ text: `Ticket ID: ${log.ticketId}`, bold: true, size: 28 }),
        ],
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated: ${formatWibDateTime(new Date())}`,
            size: 20,
            color: "666666",
          }),
        ],
        spacing: { after: 300 },
      })
    );

    // Section 1: Informasi Perubahan
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 },
        children: [new TextRun("Informasi Perubahan")],
      })
    );
    const infoRows: Array<[string, string]> = [
      ["Jenis Perangkat", log.deviceType.name],
      ["Nama Perangkat", log.deviceName],
      ["IP Address", log.deviceIp || "-"],
      ["Jenis Perubahan", log.changeType],
      ["Pemohon", log.requestor || "-"],
      ["PIC", log.pic.name],
      ["Pencatat", log.creator.name],
      ["Waktu Implementasi", formatWibDateId(log.implementedAt)],
    ];
    for (const [label, value] of infoRows) {
      children.push(labelParagraph(label, value));
    }

    // Section 2: Deskripsi Perubahan
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
        children: [new TextRun("Deskripsi Perubahan")],
      })
    );
    children.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [new TextRun({ text: "PERMINTAAN:", bold: true })],
      })
    );
    children.push(new Paragraph({ text: log.descriptionBefore, spacing: { after: 200 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "PERUBAHAN KONFIGURASI:", bold: true })],
      })
    );
    children.push(new Paragraph({ text: log.descriptionAfter, spacing: { after: 200 } }));

    // Section 3: Keterangan & Rollback Plan
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
        children: [new TextRun("Keterangan & Rollback Plan")],
      })
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "KETERANGAN:", bold: true })],
      })
    );
    children.push(new Paragraph({ text: log.reason, spacing: { after: 200 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "ROLLBACK PLAN:", bold: true })],
      })
    );
    children.push(new Paragraph({ text: log.rollbackPlan || "-" }));

    // Section 4: Screenshots
    if (log.screenshots.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
          children: [new TextRun("Bukti Screenshot")],
        })
      );

      for (const scr of log.screenshots) {
        if (scr.mimeType === "application/pdf") continue;

        const filePath = path.join(uploadBase, "screenshots", scr.filename);
        try {
          const buf = await fs.readFile(filePath);
          const imageType =
            scr.mimeType === "image/png"
              ? "png"
              : scr.mimeType === "image/jpeg"
                ? "jpg"
                : null;
          if (!imageType) continue;

          const { width: srcW, height: srcH } = getImageSize(buf);
          let dispW = Math.min(500, srcW);
          let dispH = Math.round((dispW * srcH) / srcW);
          if (dispH > 350) {
            dispH = 350;
            dispW = Math.round((dispH * srcW) / srcH);
          }

          children.push(
            new Paragraph({
              spacing: { before: 200, after: 100 },
              children: [
                new TextRun({ text: `${scr.type} - ${scr.originalName}`, bold: true, size: 20 }),
              ],
            })
          );
          children.push(
            new Paragraph({
              spacing: { after: 200 },
              children: [
                new ImageRun({
                  type: imageType,
                  data: buf,
                  transformation: { width: dispW, height: dispH },
                }),
              ],
            })
          );
        } catch {
          children.push(
            new Paragraph({
              text: `[Gambar tidak dapat ditampilkan: ${scr.originalName}]`,
            })
          );
        }
      }
    }

    const doc = new Document({
      sections: [{ children }],
      styles: {
        default: {
          document: {
            run: { font: "Calibri", size: 21 },
            paragraph: { spacing: { line: 276 } },
          },
        },
      },
    });

    const buf = await Packer.toBuffer(doc);
    const buffer = Buffer.from(buf);

    await AuditTrailService.log({
      userId,
      action: "EXPORT_WORD",
      entityType: "ChangeLog",
      entityId: changeLogId,
      metadata: { ticketId: log.ticketId },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return buffer;
  }

  private static drawSectionTitle(
    doc: any,
    title: string,
    x: number,
    y: number
  ): number {
    // Background bar
    doc
      .rect(x, y, doc.page.width - 100, 22)
      .fillColor("#1f2937")
      .fill();
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#fff")
      .text(title, x + 10, y + 5);
    doc.fillColor("#000");
    return y + 22;
  }
}
