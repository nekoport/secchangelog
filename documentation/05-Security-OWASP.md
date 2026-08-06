# Security & OWASP Compliance Document
## SecChangeLog — Sistem Pencatatan Perubahan Konfigurasi

| Field | Value |
|-------|-------|
| Document Version | 1.0.0 |
| Status | Final |
| Last Updated | 2026-08-06 |
| Standard Reference | OWASP Top 10 (2021), OWASP ASVS v4.0.3 Level 2 |

---

## 1. Pendekatan Security by Design

SecChangeLog dibangun dengan prinsip **Defense in Depth**: setiap layer memiliki kontrol keamanan sendiri, sehingga kegagalan di satu layer tidak langsung mengakibatkan breach.

```
┌──────────────────────────────────────────────────────┐
│ Layer 1: Network (Firewall, WAF)                     │
├──────────────────────────────────────────────────────┤
│ Layer 2: HTTP (TLS, HSTS, Security Headers, CORS)    │
├──────────────────────────────────────────────────────┤
│ Layer 3: Middleware (Auth check, Rate limit, IP ban) │
├──────────────────────────────────────────────────────┤
│ Layer 4: API Route (RBAC, Zod validation)            │
├──────────────────────────────────────────────────────┤
│ Layer 5: Service Layer (Business rules, Authz check) │
├──────────────────────────────────────────────────────┤
│ Layer 6: Data Access (Prisma parameterized queries)  │
├──────────────────────────────────────────────────────┤
│ Layer 7: Database (Encryption at rest, RBAC DB)      │
└──────────────────────────────────────────────────────┘
```

---

## 2. OWASP Top 10 (2021) Compliance Matrix

### A01:2021 — Broken Access Control ✅

| Control | Implementation |
|---------|----------------|
| RBAC enforced server-side | Setiap API route cek role via `requireRole()` helper |
| Deny by default | Middleware redirect ke `/login` jika tidak authenticated |
| Resource ownership check | Engineer hanya bisa edit change log yang dia buat |
| Disable directory listing | Next.js static serving tidak list direktori |
| Invalidate session after logout | NextAuth `signOut()` menghapus cookie + DB session |
| JWT validation server-side | NextAuth verify signature di setiap request |
| IDOR prevention | Cek `createdById === session.user.id` untuk edit |
| Soft-delete untuk audit trail | Change log tidak benar-benar dihapus (soft delete + audit) |

**Code example:**
```typescript
// src/lib/auth-options.ts
async function authorize(credentials) {
  // 1. Rate limit check
  // 2. Account lockout check
  // 3. Verify password (bcrypt.compare)
  // 4. Check user.isActive
  // 5. Update lastLoginAt, lastLoginIp
  // 6. Write audit trail LOGIN_SUCCESS or LOGIN_FAILED
  // 7. Return user object (without passwordHash)
}
```

### A02:2021 — Cryptographic Failures ✅

| Control | Implementation |
|---------|----------------|
| Password hashing | bcrypt cost factor 12 (≈ 250ms per hash) |
| No sensitive data in URL | Semua data sensitif via POST body |
| HTTPS-only in production | HSTS header, redirect HTTP → HTTPS |
| LDAP bind password encryption | AES-256-GCM dengan key dari env var |
| Session token | JWT signed dengan `NEXTAUTH_SECRET` (32+ random bytes) |
| No sensitive data in logs | Logger redact password, token, email di log |
| Database encryption at rest | MySQL InnoDB encryption atau disk LUKS |

### A03:2021 — Injection ✅

| Control | Implementation |
|---------|----------------|
| SQL Injection | Prisma ORM dengan parameterized queries (default safe) |
| NoSQL Injection | Tidak menggunakan NoSQL |
| OS Command Injection | Tidak ada `exec()` atau `spawn()` dengan user input |
| LDAP Injection | LDAP query menggunakan escaping library (`ldap-escape`) |
| Template Injection | React auto-escaping + tidak menggunakan `dangerouslySetInnerHTML` |

**Prisma safe query example:**
```typescript
// ✅ SAFE - Prisma parameterizes
const user = await db.user.findUnique({ where: { id: userId } });

// ✅ SAFE - Raw query with tagged template
const result = await db.$queryRaw`SELECT * FROM User WHERE email = ${email}`;

// ❌ FORBIDDEN - String concatenation
const result = await db.$queryRaw(`SELECT * FROM User WHERE email = '${email}'`);
```

### A04:2021 — Insecure Design ✅

| Control | Implementation |
|---------|----------------|
| Threat modeling | Dilakukan sebelum coding (lihat dokumen ini) |
| Secure design patterns | Layered architecture, principle of least privilege |
| Fail secure | Default deny; error tidak expose info |
| Separation of duties | Delete butuh approval supervisor |
| Business logic validation | Status workflow tidak bisa di-skip |
| Audit trail | Semua aksi tercatat untuk forensik |

### A05:2021 — Security Misconfiguration ✅

| Control | Implementation |
|---------|----------------|
| No default credentials | Seed admin menggunakan password statis `Admin@12345` (lihat 06-Deployment; disarankan segera diganti) |
| Disable unused features | Next.js experimental features dinonaktifkan |
| Security headers | Lihat daftar lengkap di bawah |
| Error handling | Tidak expose stack trace di production |
| Disable X-Powered-By | `poweredByHeader: false` di next.config |
| CORS restrict | Same-origin only (tidak ada cross-origin API) |
| DB credentials | Dari env var, tidak hardcoded |

### A06:2021 — Vulnerable and Outdated Components ✅

| Control | Implementation |
|---------|----------------|
| Dependency audit | `bun audit` di CI/CD |
| Lock file | `bun.lock` committed |
| No unpinned versions | Semua dependency pinned di package.json |
| Subscribe to security advisories | GitHub Dependabot di-enable |
| Update policy | Patch version: langsung; Minor: review; Major: planning |

### A07:2021 — Identification and Authentication Failures ✅

| Control | Implementation |
|---------|----------------|
| bcrypt password hashing | Cost factor 12 |
| Password policy | Min 10 char, uppercase, lowercase, number, symbol |
| Account lockout | 5 percobaan gagal → lock 15 menit |
| Session timeout | 8 jam (configurable via settings) |
| Session invalidation | Logout menghapus cookie + server session |
| No session in URL | Hanya via httpOnly cookie |
| Rotate session after login | NextAuth generate token baru |
| MFA (future) | Out of scope MVP, target v2 |

### A08:2021 — Software and Data Integrity Failures ✅

| Control | Implementation |
|---------|----------------|
| No untrusted deserialization | Tidak menggunakan `eval()`, `Function()`, atau `unserialize()` |
| Subresource integrity | Next.js auto-generate SRI untuk assets |
| Dependency integrity | `bun.lock` dengan checksum verification |
| File upload integrity | Magic number validation + size check (tanpa re-encode) |
| Config integrity | `SystemSetting` value divalidasi sebelum disimpan |

### A09:2021 — Security Logging and Monitoring Failures ✅

| Control | Implementation |
|---------|----------------|
| Audit trail | Semua aksi tercatat di tabel AuditTrail |
| Login attempts | LOGIN_SUCCESS dan LOGIN_FAILED tercatat |
| Privileged actions | Admin actions tercatat dengan IP dan user agent |
| Log format | Structured JSON, no sensitive data |
| Log retention | 7 tahun (compliance) |
| Alerting (future) | Out of scope MVP, target v2 (SIEM integration) |

### A10:2021 — Server-Side Request Forgery (SSRF) ✅

| Control | Implementation |
|---------|----------------|
| No URL fetch from user input | Tidak ada fitur "fetch URL from server" |
| LDAP URL whitelist | LDAP server URL hanya bisa di-set oleh Admin |
| Image URL | Hanya serve dari local filesystem (tidak proxy remote) |
| Outbound connections | Hanya ke LDAP server (jika enabled), tidak ada outbound HTTP lainnya |

---

## 3. Security Headers Configuration

**Header di level aplikasi** (di-set di `next.config.ts`, berlaku untuk semua response):

```http
# Prevent clickjacking
X-Frame-Options: DENY

# Prevent MIME sniffing
X-Content-Type-Options: nosniff

# Referrer policy
Referrer-Policy: strict-origin-when-cross-origin

# Permissions policy
Permissions-Policy: camera=(), microphone=(), geolocation=()

# DNS prefetch control
X-DNS-Prefetch-Control: on
```

> **Catatan:** CSP dan HSTS **tidak** di-set di aplikasi. HSTS di-set di reverse
> proxy (Caddy: `Strict-Transport-Security: max-age=63072000; includeSubDomains`).
> `X-Powered-By` dihapus oleh Next.js pada production build. Middleware hanya
> melakukan cek autentikasi (JWT), bukan inject headers.

---

## 4. Authentication Security Deep-Dive

### 4.1 Password Storage
```
[User Input: "MyPassword123!"]
       ↓
[bcrypt.hash(password, 12)]  →  $2b$12$N9qo8uLOickgx2ZMRZoMye...
       ↓
[Stored in DB: passwordHash column]
```

**Verifikasi:**
```
[User Input: "MyPassword123!"]
       ↓
[bcrypt.compare(input, storedHash)]  →  true / false
```

### 4.2 Account Lockout Mechanism
```typescript
async function handleFailedLogin(email: string, ip: string) {
  await db.user.update({
    where: { email },
    data: { failedAttempts: { increment: 1 } }
  });
  
  const user = await db.user.findUnique({ where: { email } });
  
  if (user.failedAttempts >= 5) {
    await db.user.update({
      where: { email },
      data: {
        failedAttempts: 0,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000) // 15 menit
      }
    });
    
    await auditTrail.log({
      action: 'ACCOUNT_LOCKED',
      userId: user.id,
      metadata: { reason: 'Too many failed attempts', ip }
    });
  }
}
```

### 4.3 LDAP Authentication Flow
```
1. User submit email + password
2. Cek apakah user ada di local DB
   ├── Jika ada dan passwordHash ≠ null → verifikasi local
   └── Jika ada dan ldapDn ≠ null → bind ke LDAP dengan user DN
3. Jika user TIDAK ada di local DB → login ditolak.
   (Auto-provisioning user dari LDAP TIDAK diimplementasikan; admin harus
    membuat user di aplikasi lalu set ldapDn-nya)
4. Update lastLoginAt, write audit trail
5. Generate JWT, set cookie
```

### 4.4 Session Token Security
- Algorithm: HS256
- Secret: `NEXTAUTH_SECRET` (min 32 bytes random)
- Cookie attributes:
  - `httpOnly: true` (tidak bisa diakses JavaScript)
  - `secure: true` (HTTPS only) — production only
  - `sameSite: 'lax'` (protection CSRF)
  - `path: '/'`
- Expiry: 8 jam
- Refresh: tidak ada refresh token terpisah; sesi JWT bertahan selama MaxAge lalu user login ulang

---

## 5. File Upload Security Pipeline

```
┌─────────────────────────────────────────────────────┐
│ 1. Authentication Check (middleware)                │
│    - Reject jika tidak ada session                  │
├─────────────────────────────────────────────────────┤
│ 2. Authorization Check (API route)                  │
│    - Reject jika role < ENGINEER                    │
├─────────────────────────────────────────────────────┤
│ 3. Rate Limit Check                                 │
│    - 20 uploads / menit per user                   │
├─────────────────────────────────────────────────────┤
│ 4. Content-Length Check                             │
│    - Reject jika > 10MB (sebelum membaca body)      │
├─────────────────────────────────────────────────────┤
│ 5. Read body to memory with size cap                │
│    - Stream with hard limit, abort jika overflow    │
├─────────────────────────────────────────────────────┤
│ 6. Magic Number Verification                        │
│    - PNG: 89 50 4E 47 0D 0A 1A 0A                   │
│    - JPEG: FF D8 FF                                  │
│    - WEBP: 52 49 46 46 ... 57 45 42 50              │
│    - PDF: 25 50 44 46                                │
│    - Reject jika tidak cocok dengan Content-Type    │
├─────────────────────────────────────────────────────┤
│ 7. File Type Whitelist                              │
│    - Allowed: image/png, image/jpeg, image/webp,    │
│      application/pdf                                │
│    - Reject lainnya                                 │
├─────────────────────────────────────────────────────┤
│ 8. Penyimpanan mentah (tanpa re-encode)              │
│    - Tidak ada re-encode/sharp di pipeline           │
│    - File disimpan apa adanya setelah validasi       │
│    - Risiko residual (metadata gambar) dicatat       │
├─────────────────────────────────────────────────────┤
│ 9. Filename Sanitization                            │
│    - Generate UUID filename: `${uuid()}.${ext}`      │
│    - Original name disimpan tapi tidak dipakai      │
│    - Path traversal: tidak mungkin (UUID only)      │
├─────────────────────────────────────────────────────┤
│ 10. Save to disk                                    │
│     - Path: /uploads/screenshots/{uuid}.{ext}       │
│     - Validate path tidak keluar dari /uploads      │
├─────────────────────────────────────────────────────┤
│ 11. Database Record                                 │
│     - Insert Screenshot record                      │
│     - Audit trail: UPLOAD_SCREENSHOT                │
├─────────────────────────────────────────────────────┤
│ 12. Return safe URL                                 │
│     - /api/files/screenshots/{id}                   │
│     - Bukan path filesystem langsung                │
└─────────────────────────────────────────────────────┘
```

---

## 6. Input Validation Strategy

### 6.1 Zod Schema Example
```typescript
// src/lib/validations/change-log.ts
import { z } from 'zod';

export const createChangeLogSchema = z.object({
  deviceTypeId: z.string().cuid(),
  deviceName: z.string().min(1, 'Nama perangkat wajib diisi').max(100),
  deviceIp: z.string().ip().optional().or(z.literal('')),
  changeType: z.enum([
    'ACL', 'ROUTING', 'NAT', 'INTERFACE', 
    'SECURITY_POLICY', 'VPN', 'OTHER'
  ]),
  descriptionBefore: z.string().min(10, 'Deskripsi sebelum minimal 10 karakter').max(5000),
  descriptionAfter: z.string().min(10, 'Deskripsi setelah minimal 10 karakter').max(5000),
  reason: z.string().min(10, 'Alasan minimal 10 karakter').max(2000),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  rollbackPlan: z.string().max(2000).optional(),
  implementedAt: z.string().datetime(),
  screenshots: z.array(z.object({
    id: z.string().cuid(),
    type: z.enum(['BEFORE', 'AFTER', 'OTHER'])
  })).max(10, 'Maksimal 10 screenshot')
});

export type CreateChangeLogInput = z.infer<typeof createChangeLogSchema>;
```

### 6.2 Server-Side Enforcement
```typescript
// src/app/api/change-logs/route.ts
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!['ENGINEER', 'SUPERVISOR', 'ADMIN'].includes(session.user.role)) {
    return forbidden();
  }
  
  const body = await req.json();
  const parsed = createChangeLogSchema.safeParse(body);
  
  if (!parsed.success) {
    return validationError(parsed.error.flatten());
  }
  
  // Service layer akan cek deviceTypeId exists, etc.
  const result = await ChangeLogService.create(parsed.data, session.user.id);
  return created(result);
}
```

---

## 7. CORS Policy

```typescript
// next.config.ts
const nextConfig = {
  async headers() {
    return [{
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
        { key: 'Access-Control-Max-Age', value: '86400' }
      ]
    }];
  }
};
```

> **MVP**: Same-origin only (tidak ada CORS preflight needed). CORS headers tetap di-set untuk future-proofing.

---

## 8. Rate Limiting Implementation

```typescript
// src/lib/security/rate-limit.ts
const RATE_LIMITS = {
  LOGIN: { requests: 5, window: 15 * 60 * 1000 }, // 5 / 15 min
  API: { requests: 100, window: 60 * 1000 },       // 100 / min
  UPLOAD: { requests: 20, window: 60 * 1000 }       // 20 / min
};

// In-memory store (single instance only)
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  config: { requests: number; window: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = store.get(key);
  
  if (!record || record.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.window });
    return { allowed: true, remaining: config.requests - 1, resetAt: now + config.window };
  }
  
  if (record.count >= config.requests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  
  record.count++;
  return { allowed: true, remaining: config.requests - record.count, resetAt: record.resetAt };
}
```

> **Production note**: Untuk multi-instance deployment, ganti ke Redis-based rate limiter.

---

## 9. Audit Trail Implementation

Setiap operasi penting menulis ke AuditTrail:

```typescript
// src/lib/services/audit-trail.service.ts
export class AuditTrailService {
  static async log(params: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await db.auditTrail.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent
      }
    });
  }
}

// Usage di service:
await AuditTrailService.log({
  userId: session.user.id,
  action: 'CREATE_CHANGE_LOG',
  entityType: 'ChangeLog',
  entityId: changeLog.id,
  metadata: { ticketId: changeLog.ticketId, deviceName: changeLog.deviceName },
  ipAddress: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent')
});
```

---

## 10. Penetration Testing Checklist

Sebelum production release, lakukan testing berikut:

### 10.1 Authentication
- [ ] Brute force login dengan 100 percobaan → akun terkunci setelah 5
- [ ] Login dengan password salah → failedAttempts increment
- [ ] Lockout expiry → akun bisa login lagi setelah 15 menit
- [ ] Session fixation attack → session berubah setelah login
- [ ] JWT tampering → invalid signature ditolak
- [ ] Logout → session benar-benar invalid

### 10.2 Authorization
- [ ] Engineer mencoba akses `/api/admin/*` → 403
- [ ] Engineer mencoba edit change log orang lain → 403
- [ ] Engineer mencoba approve delete request → 403
- [ ] Manipulasi role di JWT → signature invalid
- [ ] IDOR: ganti ID di URL → akses ditolak jika bukan owner

### 10.3 Input Validation
- [ ] Submit form dengan field kosong → validation error
- [ ] Submit dengan string sangat panjang (10000 char) → ditolak
- [ ] Submit dengan HTML `<script>alert(1)</script>` → escaped, tidak execute
- [ ] Submit dengan SQL injection `' OR '1'='1` → Prisma aman, tidak error
- [ ] Submit dengan path traversal `../../etc/passwd` → ditolak

### 10.4 File Upload
- [ ] Upload file .exe dengan Content-Type image/png → ditolak (magic number)
- [ ] Upload file > 10MB → ditolak (413)
- [ ] Upload file dengan filename `../../etc/passwd` → disimpan dengan UUID
- [ ] Upload file PHP disguised as PNG → ditolak (magic number tidak cocok)
- [ ] Upload polyglot file → ditolak

### 10.5 CSRF
- [ ] Request dari domain berbeda tanpa CSRF token → ditolak
- [ ] Form submit tanpa CSRF token → ditolak
- [ ] Cookie SameSite=lax → protection default

### 10.6 Headers
- [ ] Cek `X-Frame-Options: DENY` di response
- [ ] Cek `Content-Security-Policy` di response
- [ ] Cek `Strict-Transport-Security` di production
- [ ] Cek `X-Content-Type-Options: nosniff`
- [ ] Cek `X-Powered-By` tidak ada

### 10.7 Information Disclosure
- [ ] Error 500 tidak menampilkan stack trace
- [ ] API response tidak expose internal IDs yang sensitif
- [ ] Log file tidak berisi password/token
- [ ] Source map tidak tersedia di production

---

## 11. Secret Management

### 11.1 Environment Variables
```bash
# .env (development, gitignored)
DATABASE_URL="mysql://user:pass@localhost:3306/secchangelog"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
LDAP_ENCRYPTION_KEY="generate-with-openssl-rand-base64-32"

# .env.production (NOT in repo, set via deployment env)
DATABASE_URL="mysql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://changelog.company.com"
LDAP_ENCRYPTION_KEY="..."
```

### 11.2 Secret Generation
```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate LDAP_ENCRYPTION_KEY
openssl rand -base64 32
```

### 11.3 Secret Rotation Policy
- `NEXTAUTH_SECRET`: rotasi tahunan (invalidate semua session)
- `LDAP_ENCRYPTION_KEY`: rotasi 2 tahunan
- DB password: rotasi 6 bulanan

---

## 12. Compliance Mapping

### 12.1 ISO 27001:2022
| Control | Implementation |
|---------|----------------|
| A.5.16 Identity management | User lifecycle via admin panel |
| A.5.17 Authentication information | bcrypt + password policy |
| A.5.18 Access rights | RBAC + least privilege |
| A.8.9 Configuration management | Core feature of SecChangeLog |
| A.8.15 Logging | AuditTrail table |
| A.8.16 Monitoring activities | AuditTrail + dashboard |
| A.8.23 Web filtering | N/A (internal system) |
| A.8.28 Secure coding | OWASP compliance, this document |

### 12.2 PCI-DSS v4.0
| Requirement | Implementation |
|-------------|----------------|
| 7.2 Role-based access control | RBAC implemented |
| 8.3 Authentication factors | Username/password + future MFA |
| 10.2 Audit trails | AuditTrail table, 7-year retention |
| 10.4 Sync time | NTP di server |
| 11.3 Penetration testing | Checklist di atas |

---

## 13. Incident Response Plan

### 13.1 Security Incident Categories
1. **Critical**: Data breach, unauthorized admin access
2. **High**: Brute force success, file upload bypass
3. **Medium**: Rate limit violation, suspicious activity
4. **Low**: Failed login attempts

### 13.2 Response Steps
1. **Detect**: Audit trail monitoring, alert threshold
2. **Contain**: Disable account, block IP, revoke sessions
3. **Eradicate**: Patch vulnerability, remove malicious data
4. **Recover**: Restore dari backup jika perlu
5. **Lessons learned**: Post-mortem, update security policy

### 13.3 Contact
- Security Team Lead: [TBD]
- IT Manager: [TBD]
- Incident Response: [TBD]

---

## 14. Security Maintenance Tasks

| Task | Frequency | Owner |
|------|-----------|-------|
| Dependency audit (`bun audit`) | Weekly | DevOps |
| Penetration testing | Quarterly | External |
| Security review | Monthly | Tech Lead |
| Password rotation (admin) | Quarterly | Admin |
| Backup verification | Monthly | DevOps |
| Log review | Daily | Security Analyst |
| SSL certificate renewal | 30 days before expiry | DevOps |

---
