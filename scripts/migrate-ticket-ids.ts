import { PrismaClient } from "@prisma/client";
import { planLegacyTicketMigration } from "../src/lib/security/ticket-id";

const db = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const candidates = await db.changeLog.findMany({
    where: { ticketId: { startsWith: "SOC-" } },
    select: { id: true, ticketId: true },
  });
  const updates = planLegacyTicketMigration(candidates);
  const targets = await db.changeLog.findMany({
    where: { ticketId: { in: updates.map((row) => row.to) } },
    select: { id: true, ticketId: true },
  });
  const sourceIds = new Set(updates.map((row) => row.id));
  const collision = targets.find((row) => !sourceIds.has(row.id));
  if (collision) throw new Error(`LEGACY_TICKET_COLLISION:${collision.ticketId}`);

  console.log(`${apply ? "Apply" : "Dry-run"}: ${updates.length} legacy ticket ID(s) ready for migration.`);
  for (const row of updates) console.log(`${row.from} -> ${row.to}`);
  if (apply && updates.length > 0) {
    await db.$transaction(updates.map((row) => db.changeLog.update({ where: { id: row.id }, data: { ticketId: row.to } })));
    console.log(`Migrated ${updates.length} ticket ID(s).`);
  }
}

main().catch((error) => {
  console.error("Ticket migration aborted:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
