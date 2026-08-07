import { db } from "@/lib/db";
import type { ChangeLog } from "@prisma/client";
import { AuditTrailService } from "./audit-trail.service";

interface ExportFilters {
  search?: string;
  deviceTypeId?: string;
  riskLevel?: string;
  status?: string;
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
  throw new Error("UNSUPPORTED_IMAGE");
}

export class ExportService {
  static async getFilteredChangeLogs(filters: ExportFilters) {
    const where: Record<string, unknown> = {};

    if (!filters.includeDeleted) where.isDeleted = false;

    if (filters.search) {
      where.OR = [
        { ticketId: { contains: filters.search } },
        { deviceName: { contains: filters.search } },
        { deviceIp: { contains: filters.search } },
        { descriptionBefore: { contains: filters.search } },
        { descriptionAfter: { contains: filters.search } },
        { reason: { contains: filters.search } },
      ];
    }
    if (filters.deviceTypeId) where.deviceTypeId = filters.deviceTypeId;
    if (filters.riskLevel) where.riskLevel = filters.riskLevel;
    if (filters.status) where.status = filters.status;
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
        verifier: { select: { name: true } },
      },
      orderBy: { implementedAt: "desc" },
    });
  }

  static async exportToExcel(
    filters: ExportFilters,
    userId: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<Buffer> {
    const XLSX = await import("xlsx");

    const items = await this.getFilteredChangeLogs(filters);

    // Sheet 1: Change Logs
    const sheet1Data = items.map((log) => ({
      "Ticket ID": log.ticketId,
      "Tanggal Implementasi": log.implementedAt.toISOString().slice(0, 19).replace("T", " "),
      "Jenis Perangkat": log.deviceType.name,
      "Nama Perangkat": log.deviceName,
      "IP Address": log.deviceIp || "",
      "Jenis Perubahan": log.changeType,
      "PIC": log.pic.name,
      "Pencatat": log.creator.name,
      "Permintaan": log.descriptionBefore,
      "Perubahan Konfigurasi": log.descriptionAfter,
      "Keterangan": log.reason,
      "Rollback Plan": log.rollbackPlan || "",
      "Diverifikasi Oleh": log.verifier?.name || "",
      "Tanggal Diverifikasi": log.verifiedAt
        ? log.verifiedAt.toISOString().slice(0, 19).replace("T", " ")
        : "",
      "Tanggal Dibuat": log.createdAt.toISOString().slice(0, 19).replace("T", " "),
    }));

    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    ws1["!cols"] = [
      { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
      { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 50 }, { wch: 50 },
      { wch: 40 }, { wch: 40 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
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
        verifier: { select: { name: true } },
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
          const logoFullPath = path.join(process.cwd(), "public", logoPath);
          const logoBuffer = await fs.readFile(logoFullPath);
          // Determine image type
          if (logoPath.endsWith(".png")) {
            doc.image(logoBuffer, 50, 50, { width: 60, height: 60 });
          } else if (logoPath.endsWith(".jpg") || logoPath.endsWith(".jpeg")) {
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
          `Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
          50,
          165
        );

      doc.fillColor("#000");

      // Section 1: Change Info
      let y = 200;
      y = this.drawSectionTitle(doc, "Informasi Perubahan", 50, y);
      y += 10;

      const infoRows: Array<[string, string]> = [
        ["Jenis Perangkat", log.deviceType.name],
        ["Nama Perangkat", log.deviceName],
        ["IP Address", log.deviceIp || "-"],
        ["Jenis Perubahan", log.changeType],
        ["PIC", log.pic.name],
        ["Pencatat", log.creator.name],
        ["Waktu Implementasi", log.implementedAt.toISOString().slice(0, 19).replace("T", " ")],
        ["Diverifikasi Oleh", log.verifier?.name || "-"],
        ["Tanggal Verifikasi", log.verifiedAt ? log.verifiedAt.toISOString().slice(0, 19).replace("T", " ") : "-"],
      ];

      for (const [label, value] of infoRows) {
        doc.font("Helvetica-Bold").fontSize(9).text(label, 50, y, { width: 150 });
        doc.font("Helvetica").fontSize(9).text(value, 210, y, { width: pageWidth - 160 });
        y += 18;
      }

      y += 10;
      // Section 2: Description Before/After
      y = this.drawSectionTitle(doc, "Deskripsi Perubahan", 50, y);
      y += 10;

      doc.font("Helvetica-Bold").fontSize(9).text("PERMINTAAN:", 50, y);
      y += 14;
      doc.font("Helvetica").fontSize(9).text(log.descriptionBefore, 50, y, {
        width: pageWidth,
        lineGap: 4,
      });
      y = (doc.y as number) + 14;

      doc.font("Helvetica-Bold").fontSize(9).text("PERUBAHAN KONFIGURASI:", 50, y);
      y += 14;
      doc.font("Helvetica").fontSize(9).text(log.descriptionAfter, 50, y, {
        width: pageWidth,
        lineGap: 4,
      });
      y = (doc.y as number) + 14;

      // Section 3: Reason & Rollback
      y = this.drawSectionTitle(doc, "Keterangan & Rollback Plan", 50, y);
      y += 10;

      doc.font("Helvetica-Bold").fontSize(9).text("KETERANGAN:", 50, y);
      y += 14;
      doc.font("Helvetica").fontSize(9).text(log.reason, 50, y, {
        width: pageWidth,
        lineGap: 4,
      });
      y = (doc.y as number) + 14;

      doc.font("Helvetica-Bold").fontSize(9).text("ROLLBACK PLAN:", 50, y);
      y += 14;
      doc.font("Helvetica").fontSize(9).text(log.rollbackPlan || "-", 50, y, {
        width: pageWidth,
        lineGap: 4,
      });
      y = (doc.y as number) + 20;

      // Section 4: Screenshots
      if (log.screenshots.length > 0) {
        y = this.drawSectionTitle(doc, "Bukti Screenshot", 50, y);
        y += 10;

        for (const scr of log.screenshots) {
          if (scr.mimeType === "application/pdf") continue; // skip PDF screenshots

          // Resolve + measure first so page-break & Y-advance are accurate.
          // Note: pdfkit only advances doc.y when the image y is NOT explicit,
          // so we must compute the rendered height ourselves.
          let imgBuffer: Buffer | null = null;
          let dispW: number | null = null;
          let dispH: number | null = null;
          const filePath = path.join(
            process.env.UPLOAD_DIR || "/home/z/my-project/public/uploads",
            "screenshots",
            scr.filename
          );
          try {
            imgBuffer = await fs.readFile(filePath);
            if (scr.mimeType === "image/png" || scr.mimeType === "image/jpeg") {
              const { width: imgW, height: imgH } = getImageSize(imgBuffer);
              dispW = Math.min(500, pageWidth);
              dispH = (dispW * imgH) / imgW;
              if (dispH > 300) {
                dispH = 300;
                dispW = (dispH * imgW) / imgH;
              }
            }
          } catch {
            // file missing / unreadable -> placeholder below
          }

          const blockH = (dispH ?? 20) + 16 + 20;
          if (y + blockH > doc.page.height - 80) {
            doc.addPage();
            y = 50;
          }

          doc.font("Helvetica-Bold").fontSize(9).text(
            `${scr.type} - ${scr.originalName}`,
            50,
            y
          );
          y += 16;

          if (imgBuffer && dispW !== null && dispH !== null) {
            try {
              doc.image(imgBuffer, 50, y, { width: dispW });
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
