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
}
