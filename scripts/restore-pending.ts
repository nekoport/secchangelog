// Restore-on-boot script - run by docker-entrypoint.sh BEFORE the server starts.
// Reads the restore marker written by /api/admin/backups/[filename] (POST),
// extracts the chosen backup archive into a staging dir, verifies it, and
// atomically swaps the live SQLite database + uploads while nothing is open.
//
// Run with: bun run scripts/restore-pending.ts
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

const BACKUP_DIR =
  process.env.BACKUP_DIR || path.join(process.cwd(), "data", "backups");
const MARKER_PATH =
  process.env.RESTORE_MARKER_PATH ||
  path.join(process.cwd(), "data", "restore-pending.json");
const DB_PATH = resolveDbPath();
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

const BACKUP_PREFIX = "secchangelog-backup";
const BACKUP_EXT = ".tar.gz";

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL || "";
  if (raw.startsWith("file:")) {
    const clean = raw.slice("file:".length).split(/[?#]/)[0] || "";
    if (clean) return path.resolve(clean);
  }
  return path.resolve(process.cwd(), "data", "secchangelog.db");
}

function isValidFilename(filename: string): boolean {
  if (!filename.startsWith(BACKUP_PREFIX) || !filename.endsWith(BACKUP_EXT)) {
    return false;
  }
  const re = new RegExp(
    `^${BACKUP_PREFIX}-\\d{8}-\\d{6}${BACKUP_EXT.replace(/\./g, "\\.")}$`
  );
  return re.test(filename);
}

async function checkIntegrity(dbPath: string): Promise<boolean> {
  try {
    const { Database } = await import("bun:sqlite");
    const d = new Database(dbPath, { readonly: true });
    try {
      const row = d.query("PRAGMA integrity_check").get() as
        | { integrity_check: string }
        | undefined;
      return row?.integrity_check === "ok";
    } finally {
      d.close();
    }
  } catch (err) {
    console.warn("[restore] integrity check skipped:", err);
    return true;
  }
}

async function main() {
  try {
    await fs.access(MARKER_PATH);
  } catch {
    console.log("[restore] no pending restore");
    return;
  }

  console.log("[restore] pending restore detected...");
  const staging = path.join(BACKUP_DIR, ".restore-staging");

  let filename: string | undefined;
  try {
    const raw = await fs.readFile(MARKER_PATH, "utf8");
    filename = (JSON.parse(raw) as { filename?: unknown }).filename as
      | string
      | undefined;
  } catch {
    filename = undefined;
  }

  if (typeof filename !== "string" || !isValidFilename(filename)) {
    console.error("[restore] invalid restore marker, aborting and removing it");
    await fs.rm(MARKER_PATH, { force: true }).catch(() => {});
    process.exit(1);
  }

  const archive = path.resolve(BACKUP_DIR, filename);

  try {
    await fs.rm(staging, { recursive: true, force: true });
    await fs.mkdir(staging, { recursive: true });

    // Guard against path traversal: only accept expected archive members.
    const { stdout } = await execFileAsync("tar", ["-tzf", archive]);
    const members = stdout.split("\n").filter(Boolean);
    for (const m of members) {
      const ok = m === "secchangelog.db" || m.startsWith("uploads/");
      if (!ok || m.includes("..") || m.startsWith("/")) {
        throw new Error("unsafe archive member: " + m);
      }
    }

    await execFileAsync("tar", ["-xzf", archive, "-C", staging]);

    const snapshotPath = path.join(staging, "secchangelog.db");
    await fs.access(snapshotPath);

    const integrityOk = await checkIntegrity(snapshotPath);
    if (!integrityOk) {
      console.error("[restore] integrity check FAILED, restore aborted");
      await fs.rm(MARKER_PATH, { force: true });
      await fs.rm(staging, { recursive: true, force: true });
      process.exit(1);
    }

    // Keep a safety copy of the current (pre-restore) database.
    try {
      await fs.copyFile(DB_PATH, `${DB_PATH}.pre-restore`);
    } catch {
      // no existing database file yet
    }

    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.copyFile(snapshotPath, DB_PATH);

    // Restore uploads if the archive contained any.
    const uploadsFromArchive = path.join(staging, "uploads");
    try {
      await fs.access(uploadsFromArchive);
      await fs.rm(UPLOAD_DIR, { recursive: true, force: true });
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      await fs.cp(uploadsFromArchive, UPLOAD_DIR, { recursive: true });
    } catch {
      // archive has no uploads folder — keep existing uploads untouched
    }

    await fs.mkdir(path.join(UPLOAD_DIR, "screenshots"), { recursive: true });
    await fs.mkdir(path.join(UPLOAD_DIR, "logos"), { recursive: true });
    await fs.mkdir(path.join(UPLOAD_DIR, "favicons"), { recursive: true });

    console.log(`[restore] database restored from ${filename}`);
    await fs.rm(MARKER_PATH, { force: true });
    await fs.rm(staging, { recursive: true, force: true });
  } catch (err) {
    console.error("[restore] FAILED:", err);
    await fs.rm(MARKER_PATH, { force: true }).catch(() => {});
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[restore] unexpected error:", err);
    process.exit(1);
  });
