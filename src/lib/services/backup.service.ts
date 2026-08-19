import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "@/lib/db";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { MAX_BACKUP_RETENTION } from "@/lib/constants";

const execFileAsync = promisify(execFile);

export const BACKUP_DIR =
  process.env.BACKUP_DIR || path.join(process.cwd(), "data", "backups");

// Marker file read by docker-entrypoint.sh / scripts/restore-pending.ts
// before the server starts, so the database is swapped while it is still
// closed (no open SQLite handles) and never while the app is serving.
export const RESTORE_MARKER_PATH =
  process.env.RESTORE_MARKER_PATH ||
  path.join(process.cwd(), "data", "restore-pending.json");

// The live SQLite file, parsed from DATABASE_URL (file: URL) or a sensible default.
export function databaseFilePath(): string {
  const raw = process.env.DATABASE_URL || "";
  if (raw.startsWith("file:")) {
    const withoutProtocol = raw.slice("file:".length);
    const clean = withoutProtocol.split(/[?#]/)[0] || "";
    if (clean) return path.resolve(clean);
  }
  return path.resolve(process.cwd(), "data", "secchangelog.db");
}

const BACKUP_PREFIX = "secchangelog-backup";
const BACKUP_EXT = ".tar.gz";
const SNAPSHOT_NAME = "secchangelog.db";

export interface BackupMeta {
  filename: string;
  size: number;
  createdAt: string;
}

export class BackupService {
  static async ensureDirectory() {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  }

  private static timestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    );
  }

  private static uploadsDir(): string {
    const base = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
    return path.resolve(base);
  }

  static isValidFilename(filename: string): boolean {
    if (!filename.startsWith(BACKUP_PREFIX) || !filename.endsWith(BACKUP_EXT)) {
      return false;
    }
    // secchangelog-backup-YYYYMMDD-HHMMSS.tar.gz
    const re = new RegExp(
      `^${BACKUP_PREFIX}-\\d{8}-\\d{6}${BACKUP_EXT.replace(/\./g, "\\.")}$`
    );
    return re.test(filename);
  }

  private static safeResolve(filename: string): string {
    const p = path.resolve(BACKUP_DIR, filename);
    if (path.dirname(p) !== path.resolve(BACKUP_DIR)) {
      throw new Error("INVALID_PATH");
    }
    return p;
  }

  /**
   * Create a consistent snapshot of the database (ChangeLog + AuditTrail + all
   * tables) plus the uploads folder, bundled into a single .tar.gz file.
   */
  static async createBackup(
    userId: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<BackupMeta> {
    await this.ensureDirectory();

    const stamp = this.timestamp();
    const filename = `${BACKUP_PREFIX}-${stamp}${BACKUP_EXT}`;
    const archivePath = this.safeResolve(filename);
    const workDir = path.join(BACKUP_DIR, `.work-${stamp}`);

    try {
      await fs.mkdir(workDir, { recursive: true });

      // 1. Consistent SQLite snapshot via VACUUM INTO
      const snapshotPath = path.join(workDir, SNAPSHOT_NAME);
      const escaped = snapshotPath.replace(/'/g, "''");
      await db.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);

      // 2. Stage uploads folder (may be empty)
      const uploads = this.uploadsDir();
      let hasUploads = false;
      try {
        const st = await fs.stat(uploads);
        if (st.isDirectory()) {
          hasUploads = (await fs.readdir(uploads)).length > 0;
        }
      } catch {
        hasUploads = false;
      }

      // 3. Archive: snapshot + uploads into a single tarball
      const args = ["-czf", archivePath, "-C", workDir, SNAPSHOT_NAME];
      if (hasUploads) {
        args.push("-C", path.dirname(uploads), path.basename(uploads));
      }
      await execFileAsync("tar", args);

      // 4. Cleanup staging
      await fs.rm(workDir, { recursive: true, force: true });

      const stat = await fs.stat(archivePath);

      await AuditTrailService.log({
        userId,
        action: "CREATE_DATABASE_BACKUP",
        entityType: "DatabaseBackup",
        entityId: filename,
        metadata: { filename, size: stat.size },
        ipAddress: requestInfo?.ipAddress,
        userAgent: requestInfo?.userAgent,
      });

      // 5. Enforce retention (oldest removed first)
      await this.prune();

      return { filename, size: stat.size, createdAt: new Date().toISOString() };
    } catch (err) {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  }

  static async listBackups(): Promise<BackupMeta[]> {
    await this.ensureDirectory();
    const entries = await fs.readdir(BACKUP_DIR);
    const metas: BackupMeta[] = [];

    for (const name of entries) {
      if (!this.isValidFilename(name)) continue;
      const p = this.safeResolve(name);
      try {
        const st = await fs.stat(p);
        if (!st.isFile()) continue;
        metas.push({
          filename: name,
          size: st.size,
          createdAt: st.mtime.toISOString(),
        });
      } catch {
        // skip unreadable
      }
    }

    metas.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return metas;
  }

  static async getBackupStream(filename: string) {
    if (!this.isValidFilename(filename)) return null;
    const p = this.safeResolve(filename);
    try {
      await fs.access(p);
      const stat = await fs.stat(p);
      if (!stat.isFile()) return null;
      const stream = fsSync.createReadStream(p);
      return { stream, size: stat.size, filename };
    } catch {
      return null;
    }
  }

  static async deleteBackup(
    filename: string,
    userId: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<boolean> {
    if (!this.isValidFilename(filename)) return false;
    const p = this.safeResolve(filename);
    try {
      await fs.access(p);
      await fs.unlink(p);
    } catch {
      return false;
    }

    await AuditTrailService.log({
      userId,
      action: "DELETE_DATABASE_BACKUP",
      entityType: "DatabaseBackup",
      entityId: filename,
      metadata: { filename },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return true;
  }

  /** Remove oldest backups beyond MAX_BACKUP_RETENTION. */
  static async prune(): Promise<string[]> {
    const backups = await this.listBackups();
    if (backups.length <= MAX_BACKUP_RETENTION) return [];
    const toRemove = backups.slice(MAX_BACKUP_RETENTION);
    const removed: string[] = [];
    for (const b of toRemove) {
      try {
        await fs.unlink(this.safeResolve(b.filename));
        removed.push(b.filename);
      } catch {
        // ignore
      }
    }
    return removed;
  }

  /**
   * Schedule a restore that will be applied on the next container start.
   *
   * Restoring a SQLite database while the server holds it open is unsafe, so
   * instead we: (1) take a fresh safety backup of the current state, (2) write
   * a marker file, (3) ask the API route to exit the process. The container's
   * restart policy restarts it, docker-entrypoint.sh then runs
   * scripts/restore-pending.ts BEFORE the server starts, which extracts the
   * archive and atomically swaps the database + uploads while nothing is open.
   */
  static async prepareRestore(
    filename: string,
    userId: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<{ safetyBackup?: string }> {
    if (!this.isValidFilename(filename)) {
      throw new Error("INVALID_FILENAME");
    }
    const archivePath = this.safeResolve(filename);
    try {
      await fs.access(archivePath);
    } catch {
      throw new Error("NOT_FOUND");
    }

    // Safety net: snapshot the current state so a failed/mistaken restore is
    // reversible. Best-effort — a corrupt DB must still be restorable.
    let safetyBackup: string | undefined;
    try {
      const meta = await this.createBackup(userId, requestInfo);
      safetyBackup = meta.filename;
    } catch (err) {
      console.error("[backup] safety backup before restore failed:", err);
    }

    // Marker consumed by scripts/restore-pending.ts on next boot.
    await fs.mkdir(path.dirname(RESTORE_MARKER_PATH), { recursive: true });
    await fs.writeFile(
      RESTORE_MARKER_PATH,
      JSON.stringify(
        {
          filename,
          requestedBy: userId,
          requestedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      { encoding: "utf8" }
    );

    await AuditTrailService.log({
      userId,
      action: "RESTORE_DATABASE_BACKUP",
      entityType: "DatabaseBackup",
      entityId: filename,
      metadata: { filename, safetyBackup },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return { safetyBackup };
  }
}
