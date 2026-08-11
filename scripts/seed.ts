// Seed script - run with: bun run scripts/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Seed default device types (general categories)
  const deviceTypes = [
    { name: "Firewall", description: "Perangkat firewall jaringan" },
    { name: "Network", description: "Perangkat jaringan (router, switch, dll)" },
    { name: "Server", description: "Server fisik maupun virtual" },
    { name: "Virtual Machine", description: "Virtual machine / hypervisor" },
    { name: "Storage", description: "Penyimpanan / SAN / NAS" },
    { name: "Others", description: "Perangkat lainnya" },
  ];

  const deviceTypeIds: Record<string, string> = {};
  for (const dt of deviceTypes) {
    const item = await db.deviceType.upsert({
      where: { name: dt.name },
      create: dt,
      update: { description: dt.description },
    });
    deviceTypeIds[dt.name] = item.id;
  }
  console.log(`✓ Seeded ${deviceTypes.length} device types`);

  // 1b. Seed example devices (hostname + IP) if none exist
  const deviceCount = await db.device.count();
  if (deviceCount === 0) {
    const devices: Array<{ deviceTypeId: string; name: string; ipAddress: string }> = [
      { deviceTypeId: deviceTypeIds["Firewall"], name: "fw-01", ipAddress: "10.0.106.1" },
      { deviceTypeId: deviceTypeIds["Firewall"], name: "fw-02", ipAddress: "10.0.106.2" },
      { deviceTypeId: deviceTypeIds["Network"], name: "core-sw-01", ipAddress: "10.0.106.3" },
      { deviceTypeId: deviceTypeIds["Network"], name: "rt-01", ipAddress: "10.0.106.4" },
      { deviceTypeId: deviceTypeIds["Server"], name: "srv-app-01", ipAddress: "10.0.106.10" },
      { deviceTypeId: deviceTypeIds["Server"], name: "srv-db-01", ipAddress: "10.0.106.11" },
      { deviceTypeId: deviceTypeIds["Virtual Machine"], name: "vm-win-01", ipAddress: "10.0.106.20" },
      { deviceTypeId: deviceTypeIds["Virtual Machine"], name: "vm-lin-01", ipAddress: "10.0.106.21" },
    ];
    for (const d of devices) {
      await db.device.upsert({
        where: { deviceTypeId_name: { deviceTypeId: d.deviceTypeId, name: d.name } },
        create: d,
        update: { ipAddress: d.ipAddress },
      });
    }
    console.log(`✓ Seeded ${devices.length} example devices`);
  } else {
    console.log(`✓ Devices already exist (${deviceCount}), skipping example devices`);
  }

  // 2. Seed default admin user
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@secchangelog.local";
  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME || "Administrator";

  const existingAdmin = await db.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    // Fail-closed: never create an admin with a default/guessed password.
    if (!adminPassword || adminPassword.length < 10) {
      throw new Error(
        "SEED_ADMIN_PASSWORD wajib di-set (minimal 10 karakter) untuk membuat admin pertama."
      );
    }
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.user.create({
      data: {
        email: adminEmail,
        username: adminUsername,
        name: adminName,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });
    console.log(`✓ Created admin user: ${adminEmail}`);
    console.log(`  Username: ${adminUsername}`);
    console.log(`  ⚠️  Password diambil dari env SEED_ADMIN_PASSWORD`);
    console.log(`  ⚠️  Ganti password setelah login pertama!`);
  } else {
    console.log(`✓ Admin user already exists: ${adminEmail}`);
  }

  // 2b. Backfill username for existing users that don't have one yet
  const usersWithoutUsername = await db.user.findMany({
    where: { username: null },
  });
  for (const u of usersWithoutUsername) {
    // Derive a unique username from the local part of the email
    let base = u.email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase() || "user";
    let candidate = base;
    let suffix = 1;
    while (true) {
      const clash = await db.user.findFirst({
        where: { username: candidate, NOT: { id: u.id } },
      });
      if (!clash) break;
      candidate = `${base}${suffix++}`;
    }
    await db.user.update({
      where: { id: u.id },
      data: { username: candidate },
    });
  }
  if (usersWithoutUsername.length > 0) {
    console.log(
      `✓ Backfilled username for ${usersWithoutUsername.length} existing user(s)`
    );
  }

  // 3. Seed default system settings
  const settings = [
    { key: "system.name", value: "SecChangeLog" },
    { key: "system.logoPath", value: "" },
    { key: "system.faviconPath", value: "" },
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
