import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_LOGO_SIZE,
} from "../constants";

// Magic number signatures (first few bytes of file)
const MAGIC_NUMBERS: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF...WEBP
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
}

export function validateFileByMagicNumber(
  buffer: Buffer,
  declaredMimeType: string
): FileValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(declaredMimeType)) {
    return {
      valid: false,
      error: `Tipe file ${declaredMimeType} tidak diizinkan. Hanya PNG, JPEG, WEBP, PDF.`,
    };
  }

  const magic = MAGIC_NUMBERS[declaredMimeType];
  if (!magic) {
    return { valid: false, error: "Tipe file tidak dikenali" };
  }

  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) {
      return {
        valid: false,
        error:
          "File tidak valid: signature tidak cocok dengan tipe yang dideklarasikan",
      };
    }
  }

  // For WEBP, also check the WEBP marker at offset 8-11
  if (declaredMimeType === "image/webp") {
    const webpMarker = buffer.slice(8, 12).toString("ascii");
    if (webpMarker !== "WEBP") {
      return { valid: false, error: "File WEBP tidak valid" };
    }
  }

  return { valid: true, detectedMimeType: declaredMimeType };
}

export function validateFileSize(
  size: number,
  isLogo: boolean = false
): FileValidationResult {
  const maxSize = isLogo ? MAX_LOGO_SIZE : MAX_FILE_SIZE;
  if (size > maxSize) {
    const maxMb = Math.floor(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `Ukuran file melebihi ${maxMb}MB`,
    };
  }
  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  // Remove path components
  const basename = filename.replace(/[/\\]/g, "").replace(/^\./, "");
  // Keep only alphanumeric, dash, underscore, dot
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  const ext = parts[parts.length - 1].toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext) ? ext : "";
}

export function generateSafeFilename(originalName: string): string {
  const ext = getFileExtension(originalName);
  const uuid = crypto.randomUUID();
  return ext ? `${uuid}.${ext}` : uuid;
}

// Path traversal prevention: ensure path stays within base directory
import path from "path";

export function safeJoinPath(baseDir: string, ...parts: string[]): string {
  const resolved = path.resolve(baseDir, ...parts);
  const normalizedBase = path.resolve(baseDir);
  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}
