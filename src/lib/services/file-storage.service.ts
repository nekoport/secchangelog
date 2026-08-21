import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import {
  validateFileByMagicNumber,
  validateFileSize,
  generateSafeFilename,
  sanitizeFilename,
  safeJoinPath,
} from "@/lib/security/file-validation";
import { AuditTrailService } from "./audit-trail.service";
import {
  MAX_ORPHAN_SCREENSHOTS_PER_USER,
  MAX_ORPHAN_UPLOAD_BYTES_PER_USER,
  ORPHAN_SCREENSHOT_TTL_MS,
  type ScreenshotType,
} from "@/lib/constants";
import {
  canDeleteScreenshot,
  type AppRole,
} from "@/lib/security/authorization";

const UPLOAD_BASE =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
const SCREENSHOTS_DIR = path.join(UPLOAD_BASE, "screenshots");
const LOGOS_DIR = path.join(UPLOAD_BASE, "logos");
const FAVICONS_DIR = path.join(UPLOAD_BASE, "favicons");

export class FileStorageService {
  static async ensureDirectories() {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    await fs.mkdir(LOGOS_DIR, { recursive: true });
    await fs.mkdir(FAVICONS_DIR, { recursive: true });
  }

  static async saveScreenshot(
    buffer: Buffer,
    originalName: string,
    declaredMimeType: string,
    type: ScreenshotType,
    userId: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    await this.ensureDirectories();

    // Validate file type by magic number
    const magicCheck = validateFileByMagicNumber(buffer, declaredMimeType);
    if (!magicCheck.valid) {
      throw new Error(magicCheck.error || "File tidak valid");
    }

    // Validate size
    const sizeCheck = validateFileSize(buffer.length);
    if (!sizeCheck.valid) {
      throw new Error(sizeCheck.error || "File terlalu besar");
    }

    await this.cleanupOrphanScreenshots(userId);
    const orphanUsage = await db.screenshot.aggregate({
      where: { uploadedById: userId, changeLogId: null },
      _count: { _all: true },
      _sum: { size: true },
    });
    if (
      orphanUsage._count._all >= MAX_ORPHAN_SCREENSHOTS_PER_USER ||
      (orphanUsage._sum.size || 0) + buffer.length >
        MAX_ORPHAN_UPLOAD_BYTES_PER_USER
    ) {
      throw new Error("UPLOAD_QUOTA_EXCEEDED");
    }

    const safeName = generateSafeFilename(originalName);
    const filePath = safeJoinPath(SCREENSHOTS_DIR, safeName);

    // Write file
    await fs.writeFile(filePath, buffer);

    // Create DB record (changeLogId nullable - will be linked when change log created)
    let screenshot;
    try {
      screenshot = await db.screenshot.create({
        data: {
          changeLogId: null, // will be linked when change log is created
          uploadedById: userId,
          filename: safeName,
          originalName: sanitizeFilename(originalName),
          mimeType: declaredMimeType,
          size: buffer.length,
          type,
        },
      });
    } catch (err) {
      await fs.unlink(filePath).catch(() => {});
      throw err;
    }

    await AuditTrailService.log({
      userId,
      action: "UPLOAD_SCREENSHOT",
      entityType: "Screenshot",
      entityId: screenshot.id,
      metadata: {
        filename: safeName,
        size: buffer.length,
        type,
        mimeType: declaredMimeType,
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return screenshot;
  }

  static async getScreenshotFile(id: string) {
    const screenshot = await db.screenshot.findUnique({ where: { id } });
    if (!screenshot) return null;

    const filePath = safeJoinPath(SCREENSHOTS_DIR, screenshot.filename);
    try {
      const buffer = await fs.readFile(filePath);
      return {
        buffer,
        mimeType: screenshot.mimeType,
        filename: screenshot.originalName,
      };
    } catch {
      return null;
    }
  }

  static async deleteScreenshot(
    id: string,
    userId: string,
    userRole: AppRole,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const screenshot = await db.screenshot.findUnique({
      where: { id },
      include: {
        changeLog: { select: { createdById: true } },
      },
    });
    if (!screenshot) throw new Error("NOT_FOUND");
    if (
      !canDeleteScreenshot({
        role: userRole,
        userId,
        uploadedById: screenshot.uploadedById,
        changeLogCreatedById: screenshot.changeLog?.createdById || null,
      })
    ) {
      throw new Error("FORBIDDEN");
    }

    // Delete file
    const filePath = safeJoinPath(SCREENSHOTS_DIR, screenshot.filename);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may not exist; ignore
    }

    // Delete DB record
    await db.screenshot.delete({ where: { id } });

    await AuditTrailService.log({
      userId,
      action: "DELETE_SCREENSHOT",
      entityType: "Screenshot",
      entityId: id,
      metadata: { filename: screenshot.filename },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });
  }

  private static async cleanupOrphanScreenshots(userId: string) {
    const expired = await db.screenshot.findMany({
      where: {
        uploadedById: userId,
        changeLogId: null,
        createdAt: { lt: new Date(Date.now() - ORPHAN_SCREENSHOT_TTL_MS) },
      },
      select: { id: true, filename: true },
    });
    if (expired.length === 0) return;

    for (const screenshot of expired) {
      const filePath = safeJoinPath(SCREENSHOTS_DIR, screenshot.filename);
      await fs.unlink(filePath).catch(() => {});
    }
    await db.screenshot.deleteMany({
      where: { id: { in: expired.map((screenshot) => screenshot.id) } },
    });
  }

  static async saveLogo(
    buffer: Buffer,
    originalName: string,
    declaredMimeType: string
  ): Promise<string> {
    await this.ensureDirectories();

    // Logo only allows PNG/SVG/WebP
    if (!["image/png", "image/webp", "image/svg+xml"].includes(declaredMimeType)) {
      throw new Error("Logo harus PNG, WEBP, atau SVG");
    }

    // For SVG, skip magic number check (it's text-based)
    if (declaredMimeType !== "image/svg+xml") {
      const magicCheck = validateFileByMagicNumber(buffer, declaredMimeType);
      if (!magicCheck.valid) {
        throw new Error(magicCheck.error || "File tidak valid");
      }
    } else {
      // Basic SVG validation: check it starts with <svg or <?xml
      const head = buffer.slice(0, 200).toString("utf-8").trim();
      if (!head.startsWith("<") || !head.includes("svg")) {
        throw new Error("File SVG tidak valid");
      }
    }

    const sizeCheck = validateFileSize(buffer.length, true);
    if (!sizeCheck.valid) {
      throw new Error(sizeCheck.error || "File terlalu besar");
    }

    const ext = declaredMimeType === "image/svg+xml" ? "svg" : 
                declaredMimeType === "image/png" ? "png" : "webp";
    const filename = `system-logo.${ext}`;
    const filePath = safeJoinPath(LOGOS_DIR, filename);

    // Remove old logo files
    try {
      const files = await fs.readdir(LOGOS_DIR);
      for (const f of files) {
        if (f.startsWith("system-logo") && f !== filename) {
          await fs.unlink(safeJoinPath(LOGOS_DIR, f)).catch(() => {});
        }
      }
    } catch {
      // ignore
    }

    await fs.writeFile(filePath, buffer);

    // Append cache-busting version so re-uploading with the same filename
    // doesn't get served from the browser cache
    return `/uploads/logos/${filename}?v=${Date.now()}`;
  }

  static async getLogoBuffer(filename: string) {
    const safeName = sanitizeFilename(filename);
    if (!safeName.startsWith("system-logo")) {
      throw new Error("Invalid logo filename");
    }
    const filePath = safeJoinPath(LOGOS_DIR, safeName);
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  static async getFaviconBuffer(filename: string) {
    const safeName = sanitizeFilename(filename);
    if (!safeName.startsWith("system-favicon")) {
      throw new Error("Invalid favicon filename");
    }
    const filePath = safeJoinPath(FAVICONS_DIR, safeName);
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  static async clearLogos(): Promise<void> {
    try {
      const files = await fs.readdir(LOGOS_DIR);
      for (const f of files) {
        if (f.startsWith("system-logo")) {
          await fs.unlink(safeJoinPath(LOGOS_DIR, f)).catch(() => {});
        }
      }
    } catch {
      // ignore
    }
  }

  static async saveFavicon(
    buffer: Buffer,
    originalName: string,
    declaredMimeType: string
  ): Promise<string> {
    await this.ensureDirectories();

    // Favicon only allows SVG/PNG/WebP/ICO
    const allowed = ["image/png", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
    if (!allowed.includes(declaredMimeType)) {
      throw new Error("Favicon harus PNG, WEBP, SVG, atau ICO");
    }

    // For SVG/ICO skip magic number check (text/binary based)
    if (declaredMimeType === "image/svg+xml") {
      const head = buffer.slice(0, 200).toString("utf-8").trim();
      if (!head.startsWith("<") || !head.includes("svg")) {
        throw new Error("File SVG tidak valid");
      }
    } else if (!declaredMimeType.startsWith("image/x-icon") && !declaredMimeType.startsWith("image/vnd")) {
      const magicCheck = validateFileByMagicNumber(buffer, declaredMimeType);
      if (!magicCheck.valid) {
        throw new Error(magicCheck.error || "File tidak valid");
      }
    }

    const sizeCheck = validateFileSize(buffer.length, true);
    if (!sizeCheck.valid) {
      throw new Error(sizeCheck.error || "File terlalu besar");
    }

    const ext =
      declaredMimeType === "image/svg+xml" ? "svg" :
      declaredMimeType.endsWith("x-icon") || declaredMimeType.endsWith("vnd.microsoft.icon") ? "ico" :
      declaredMimeType === "image/png" ? "png" : "webp";
    const filename = `system-favicon.${ext}`;
    const filePath = safeJoinPath(FAVICONS_DIR, filename);

    // Remove old favicon files
    try {
      const files = await fs.readdir(FAVICONS_DIR);
      for (const f of files) {
        if (f.startsWith("system-favicon") && f !== filename) {
          await fs.unlink(safeJoinPath(FAVICONS_DIR, f)).catch(() => {});
        }
      }
    } catch {
      // ignore
    }

    await fs.writeFile(filePath, buffer);

    // Cache-busting version (see saveLogo)
    return `/uploads/favicons/${filename}?v=${Date.now()}`;
  }

  static async clearFavicons(): Promise<void> {
    try {
      const files = await fs.readdir(FAVICONS_DIR);
      for (const f of files) {
        if (f.startsWith("system-favicon")) {
          await fs.unlink(safeJoinPath(FAVICONS_DIR, f)).catch(() => {});
        }
      }
    } catch {
      // ignore
    }
  }
}
