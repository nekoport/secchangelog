export const MAX_BACKUP_MEMBER_COUNT = 10_000;
export const MAX_BACKUP_UNCOMPRESSED_SIZE = 512 * 1024 * 1024;
export const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "ascii");

export function validateBackupMemberName(name: string): boolean {
  if (!name || name.includes("\\") || name.startsWith("/") || name.includes("\0")) return false;
  const clean = name.endsWith("/") ? name.slice(0, -1) : name;
  if (clean.split("/").some((part) => !part || part === "." || part === "..")) return false;
  return clean === "secchangelog.db" || clean === "uploads" || clean.startsWith("uploads/");
}

export function hasSqliteHeader(buf: Buffer): boolean {
  return buf.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER);
}

export function validateArchiveEntries(names: string[], verboseLines: string[]): { names: string[]; uncompressedSize: number } {
  if (!names.length || names.length !== verboseLines.length || names.length > MAX_BACKUP_MEMBER_COUNT) throw new Error("INVALID_ARCHIVE");
  let total = 0;
  for (let i = 0; i < names.length; i++) {
    const line = verboseLines[i];
    const type = line[0];
    if (type !== "-" && type !== "d") throw new Error("UNSAFE_ARCHIVE");
    const tokens = line.trim().split(/\s+/);
    const size = Number(tokens[2]);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("INVALID_ARCHIVE");
    total += size;
    if (total > MAX_BACKUP_UNCOMPRESSED_SIZE) throw new Error("ARCHIVE_TOO_LARGE");
    if (!validateBackupMemberName(names[i])) throw new Error("UNSAFE_ARCHIVE");
  }
  if (!names.includes("secchangelog.db")) throw new Error("MISSING_DATABASE");
  return { names, uncompressedSize: total };
}
