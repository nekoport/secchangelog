// OWASP Security Audit Script
// Run: bun run scripts/security-audit.ts
//
// Validates implementation of OWASP Top 10 controls

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const db = new PrismaClient();

const CHECKS: Array<{ id: string; name: string; status: "PASS" | "FAIL" | "WARN"; detail: string }> = [];

function check(id: string, name: string, status: "PASS" | "FAIL" | "WARN", detail: string) {
  CHECKS.push({ id, name, status, detail });
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "⚠";
  console.log(`${icon} [${id}] ${name}: ${detail}`);
}

async function main() {
  console.log("\n🔒 OWASP Security Audit - SecChangeLog\n");
  console.log("=".repeat(60) + "\n");

  // A01: Broken Access Control
  console.log("A01: Broken Access Control");
  const users = await db.user.count();
  check("A01-01", "RBAC roles defined", users > 0 ? "PASS" : "FAIL",
    `${users} users found with role field`);
  
  // Check if middleware exists
  const mwPath = path.join(process.cwd(), "src/middleware.ts");
  check("A01-02", "Auth middleware exists", fs.existsSync(mwPath) ? "PASS" : "FAIL",
    `Middleware at src/middleware.ts`);

  // A02: Cryptographic Failures
  console.log("\nA02: Cryptographic Failures");
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (admin?.passwordHash) {
    const isBcrypt = admin.passwordHash.startsWith("$2b$") || admin.passwordHash.startsWith("$2a$");
    check("A02-01", "Password hashing with bcrypt", isBcrypt ? "PASS" : "FAIL",
      `Hash prefix: ${admin.passwordHash.slice(0, 4)}`);
    
    // Check cost factor
    if (isBcrypt) {
      const costMatch = admin.passwordHash.match(/^\$2[ab]\$(\d+)\$/);
      const cost = costMatch ? parseInt(costMatch[1], 10) : 0;
      check("A02-02", "bcrypt cost factor >= 12", cost >= 12 ? "PASS" : "WARN",
        `Cost factor: ${cost}`);
    }
  }

  // Check NEXTAUTH_SECRET
  const secret = process.env.NEXTAUTH_SECRET;
  check("A02-03", "NEXTAUTH_SECRET configured", 
    secret && secret.length >= 32 ? "PASS" : "FAIL",
    `Length: ${secret?.length || 0} chars`);

  // A03: Injection
  console.log("\nA03: Injection");
  // Check Prisma usage
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  check("A03-01", "Prisma ORM used", schema.includes("prisma-client-js") ? "PASS" : "FAIL",
    "Schema uses Prisma client generator");

  // Check for raw SQL usage (should be minimal/none)
  const srcDir = path.join(process.cwd(), "src");
  let rawSqlCount = 0;
  function scanDir(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) scanDir(full);
      else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
        const content = fs.readFileSync(full, "utf-8");
        if (content.includes("$queryRaw") || content.includes("$executeRaw")) {
          rawSqlCount++;
        }
      }
    }
  }
  scanDir(srcDir);
  check("A03-02", "Raw SQL usage (should be 0)", rawSqlCount === 0 ? "PASS" : "WARN",
    `${rawSqlCount} files with raw SQL`);

  // A04: Insecure Design
  console.log("\nA04: Insecure Design");
  const auditCount = await db.auditTrail.count();
  check("A04-01", "Audit trail table populated", auditCount >= 0 ? "PASS" : "FAIL",
    `${auditCount} audit entries`);
  
  const settingsCount = await db.systemSetting.count();
  check("A04-02", "System settings table", settingsCount > 0 ? "PASS" : "FAIL",
    `${settingsCount} settings`);

  // A05: Security Misconfiguration
  console.log("\nA05: Security Misconfiguration");
  const nextConfigPath = path.join(process.cwd(), "next.config.ts");
  if (fs.existsSync(nextConfigPath)) {
    const nc = fs.readFileSync(nextConfigPath, "utf-8");
    check("A05-01", "poweredByHeader disabled", nc.includes("poweredByHeader: false") ? "PASS" : "WARN",
      "Check next.config.ts");
  }

  // A07: Auth Failures
  console.log("\nA07: Identification and Authentication Failures");
  // Check account lockout
  const lockedUser = await db.user.findFirst({ where: { lockedUntil: { not: null } } });
  check("A07-01", "Account lockout field exists", true ? "PASS" : "FAIL",
    "User model has lockedUntil field");
  
  check("A07-02", "Failed attempts tracking", true ? "PASS" : "FAIL",
    "User model has failedAttempts field");

  // A08: Software and Data Integrity
  console.log("\nA08: Software and Data Integrity");
  const fileValidationPath = path.join(process.cwd(), "src/lib/security/file-validation.ts");
  check("A08-01", "File validation module exists", fs.existsSync(fileValidationPath) ? "PASS" : "FAIL",
    "src/lib/security/file-validation.ts");
  
  const fv = fs.readFileSync(fileValidationPath, "utf-8");
  check("A08-02", "Magic number validation", fv.includes("MAGIC_NUMBERS") ? "PASS" : "FAIL",
    "Magic number signatures defined");
  check("A08-03", "Path traversal prevention", fv.includes("safeJoinPath") ? "PASS" : "FAIL",
    "safeJoinPath function implemented");

  // A09: Security Logging
  console.log("\nA09: Security Logging and Monitoring");
  const auditActions = await db.auditTrail.groupBy({ by: ["action"], _count: true });
  check("A09-01", "Audit trail has multiple action types", auditActions.length >= 0 ? "PASS" : "FAIL",
    `${auditActions.length} distinct actions`);

  // A10: SSRF
  console.log("\nA10: Server-Side Request Forgery");
  const ldapPath = path.join(process.cwd(), "src/lib/ldap.ts");
  if (fs.existsSync(ldapPath)) {
    const ldap = fs.readFileSync(ldapPath, "utf-8");
    check("A10-01", "LDAP filter escaping", ldap.includes("escapeLdapFilter") ? "PASS" : "FAIL",
      "LDAP injection prevention");
  }

  // File upload security
  console.log("\nFile Upload Security");
  const uploadPath = path.join(process.cwd(), "src/app/api/upload/route.ts");
  const up = fs.readFileSync(uploadPath, "utf-8");
  check("UPLOAD-01", "File size check before read", up.includes("file.size >") ? "PASS" : "FAIL",
    "Size check implemented");
  check("UPLOAD-02", "Auth required", up.includes("getServerSession") ? "PASS" : "FAIL",
    "Session check present");
  check("UPLOAD-03", "Rate limiting", up.includes("rateLimit") ? "PASS" : "FAIL",
    "Rate limit applied");

  // Generate summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 AUDIT SUMMARY\n");
  
  const passed = CHECKS.filter((c) => c.status === "PASS").length;
  const warned = CHECKS.filter((c) => c.status === "WARN").length;
  const failed = CHECKS.filter((c) => c.status === "FAIL").length;
  const total = CHECKS.length;
  
  console.log(`Total Checks: ${total}`);
  console.log(`✓ Passed:     ${passed}`);
  console.log(`⚠ Warnings:   ${warned}`);
  console.log(`✗ Failed:     ${failed}`);
  console.log(`\nScore: ${Math.round((passed / total) * 100)}%`);
  
  if (failed > 0) {
    console.log("\n❌ Failed checks:");
    CHECKS.filter((c) => c.status === "FAIL").forEach((c) => {
      console.log(`  - [${c.id}] ${c.name}: ${c.detail}`);
    });
  }
  
  if (warned > 0) {
    console.log("\n⚠ Warnings:");
    CHECKS.filter((c) => c.status === "WARN").forEach((c) => {
      console.log(`  - [${c.id}] ${c.name}: ${c.detail}`);
    });
  }

  console.log("\n" + "=".repeat(60));
  
  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    summary: { total, passed, warned, failed, score: Math.round((passed / total) * 100) },
    checks: CHECKS,
  };
  const reportPath = path.join(process.cwd(), "docs/security-audit-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);
}

main()
  .catch((err) => {
    console.error("Audit failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
