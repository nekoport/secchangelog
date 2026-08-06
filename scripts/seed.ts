// Seed script - run with: bun run scripts/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Seed default device types
  const deviceTypes = [
    { name: "Switch", description: "Network switch (Cisco, Aruba, HP, dll)" },
    { name: "Router MikroTik", description: "RouterOS-based devices" },
    { name: "Firewall Palo Alto", description: "Palo Alto Networks PAN-OS" },
    { name: "Firewall Fortinet", description: "FortiGate firewall" },
    { name: "Server Linux", description: "Linux server configuration" },
    { name: "Server Windows", description: "Windows server configuration" },
  ];

  for (const dt of deviceTypes) {
    await db.deviceType.upsert({
      where: { name: dt.name },
      create: dt,
      update: { description: dt.description },
    });
  }
  console.log(`✓ Seeded ${deviceTypes.length} device types`);

  // 2. Seed default admin user
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@secchangelog.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  const adminName = process.env.SEED_ADMIN_NAME || "Administrator";

  const existingAdmin = await db.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });
    console.log(`✓ Created admin user: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  ⚠️  Ganti password setelah login pertama!`);
  } else {
    console.log(`✓ Admin user already exists: ${adminEmail}`);
  }

  // 3. Seed default system settings
  const settings = [
    { key: "system.name", value: "SecChangeLog" },
    { key: "system.logoPath", value: "" },
    { key: "system.defaultTheme", value: "dark" },
    { key: "ldap.enabled", value: "false" },
    { key: "ldap.url", value: "" },
    { key: "ldap.bindDn", value: "" },
    { key: "ldap.bindPassword", value: "" },
    { key: "ldap.searchBase", value: "" },
    { key: "ldap.searchFilter", value: "(sAMAccountName={username})" },
    { key: "password.minLength", value: "10" },
    { key: "password.requireUppercase", value: "true" },
    { key: "password.requireLowercase", value: "true" },
    { key: "password.requireNumber", value: "true" },
    { key: "password.requireSymbol", value: "true" },
    { key: "upload.maxFileSizeMb", value: "10" },
    { key: "session.timeoutHours", value: "8" },
  ];

  // Find admin user ID for updatedById
  const adminUser = await db.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) throw new Error("Admin user not found after creation");

  for (const s of settings) {
    await db.systemSetting.upsert({
      where: { key: s.key },
      create: { ...s, updatedById: adminUser.id },
      update: {}, // don't overwrite existing
    });
  }
  console.log(`✓ Seeded ${settings.length} system settings`);

  console.log("\n✅ Seed completed!");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
