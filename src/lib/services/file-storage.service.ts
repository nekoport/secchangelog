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
import type { ScreenshotType } from "@/lib/constants";

const UPLOAD_BASE = process.env.UPLOAD_DIR || "/home/z/my-project/public/uploads";
const SCREENSHOTS_DIR = path.join(UPLOAD_BASE, "screenshots");
const LOGOS_DIR = path.join(UPLOAD_BASE, "logos");

export class FileStorageService {
  static async ensureDirectories() {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    await fs.mkdir(LOGOS_DIR, { recursive: true });
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

    const safeName = generateSafeFilename(originalName);
    const filePath = safeJoinPath(SCREENSHOTS_DIR, safeName);

    // Write file
    await fs.writeFile(filePath, buffer);

    // Create DB record (changeLogId nullable - will be linked when change log created)
    const screenshot = await db.screenshot.create({
      data: {
        changeLogId: null, // will be linked when change log is created
        filename: safeName,
        originalName: sanitizeFilename(originalName),
        mimeType: declaredMimeType,
        size: buffer.length,
        type,
      },
    });

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
    userRole: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const screenshot = await db.screenshot.findUnique({ where: { id } });
    if (!screenshot) throw new Error("NOT_FOUND");

    // Check ownership via change log
    if (userRole !== "ADMIN") {
      if (!screenshot.changeLogId) {
        throw new Error("FORBIDDEN");
      }
      const changeLog = await db.changeLog.findUnique({
        where: { id: screenshot.changeLogId },
      });
      if (!changeLog || changeLog.createdById !== userId) {
        throw new Error("FORBIDDEN");
      }
      if (changeLog.status !== "DRAFT") {
        throw new Error("DELETE_NOT_ALLOWED");
      }
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

    return `/uploads/logos/${filename}`;
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
}
