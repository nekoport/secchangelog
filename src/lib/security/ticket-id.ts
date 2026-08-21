export const NEW_TICKET_PATTERN = /^SOC-\d{8}-\d{4}$/;
export const LEGACY_TICKET_PATTERN = /^SOC-(\d{4})\/(\d{2})\/(\d{2})-(\d{4})$/;

export function formatTicketId(date: Date, sequence: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) throw new Error("INVALID_TICKET_SEQUENCE");
  return `SOC-${y}${m}${d}-${String(sequence).padStart(4, "0")}`;
}

export function migrateLegacyTicketId(ticket: string): string | null {
  const m = LEGACY_TICKET_PATTERN.exec(ticket);
  return m ? `SOC-${m[1]}${m[2]}${m[3]}-${m[4]}` : null;
}

export function planLegacyTicketMigration(rows: Array<{ id: string; ticketId: string }>) {
  const updates = rows.flatMap((row) => {
    const next = migrateLegacyTicketId(row.ticketId);
    return next ? [{ id: row.id, from: row.ticketId, to: next }] : [];
  });
  const targets = new Set<string>();
  for (const update of updates) {
    if (targets.has(update.to)) throw new Error("LEGACY_TICKET_COLLISION");
    targets.add(update.to);
  }
  return updates;
}
