# Deployment Guide
## SecChangeLog — Sistem Pencatatan Perubahan Konfigurasi

| Field | Value |
|-------|-------|
| Document Version | 2.0.0 |
| Status | Final |
| Last Updated | 2026-08-06 |
| Environment | Docker Compose + Bun + SQLite + Caddy (self-signed TLS) |

> **Catatan pembaruan besar**: Panduan ini ditulis ulang agar sesuai dengan
> **deployment Docker yang sebenarnya**. Dokumentasi sebelumnya menargetkan
> MySQL 8 + PM2 + Nginx + Let's Encrypt; sekarang deployment resmi memakai
> **Docker Compose** dengan **SQLite** dan **Caddy** sebagai reverse proxy.

---

## 1. Prasyarat

- Docker Engine ≥ 24 + Docker Compose v2
- UU urls permission: user deploy berada di grup `docker` (`sudo usermod -aG docker $USER`)
- Aplikasi dijalankan sebagai container; tidak perlu Node.js/Bun/Prisma di host

---

## 2. Struktur Deployment

```
/opt/secchangelog/
├── Dockerfile                  # Multi-stage build (oven/bun base)
├── docker-compose.yaml         # Orchestrasi app + caddy
├── docker-entrypoint.sh        # db:push + seed + start server
├── Caddyfile                   # Reverse proxy + TLS self-signed
├── .env                        # Konfigurasi runtime (jangan dicommit)
├── certs/
│   ├── fullchain.pem           # Self-signed cert (CN=SERVER_IP)
│   └── privkey.pem             # Private key
├── prisma/                     # schema.prisma (@prisma/client + @prisma/client/db)
├── scripts/                    # seed.ts, security-audit.ts
└── .next/                      # Hasil build standalone
```

---

## 3. Instalasi (Production)

### 3.1 Salin sumber ke server

```bash
# Dari mesin local (contoh Windows, pakai pscp):
pscp -r -pw '<SEKARANG>' secchangelog glpi@10.0.106.233:/home/glpi/secchangelog
# Lalu di server:
sudo mv /home/glpi/secchangelog /opt/secchangelog
sudo chown -R glpi:glpi /opt/secchangelog
```

### 3.2 Setup environment (`.env`)

```env
DATABASE_URL="file:/app/data/secchangelog.db"
NEXTAUTH_SECRET="<min 32 byte random>"
NEXTAUTH_URL="https://<SERVER_IP>:9445"
LDAP_ENCRYPTION_KEY="<min 32 byte random>"
UPLOAD_DIR="/app/public/uploads"
MAX_FILE_SIZE_MB=10
NODE_ENV="production"
SEED_ADMIN_EMAIL="admin@secchangelog.local"
SEED_ADMIN_PASSWORD="<ganti segera setelah first login>"
SEED_ADMIN_NAME="Administrator"
```

### 3.3 Generate secrets

```bash
openssl rand -base64 48   # untuk NEXTAUTH_SECRET
openssl rand -base64 48   # untuk LDAP_ENCRYPTION_KEY
```

### 3.4 Buat sertifikat self-signed (untuk internal / IP)

```bash
mkdir -p /opt/secchangelog/certs
cd /opt/secchangelog/certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout privkey.pem -out fullchain.pem -days 825 \
  -subj "/CN=10.0.106.233" \
  -addext "subjectAltName=IP:10.0.106.233"
```

> Bila tersedia domain dan port publik, ganti ke Let's Encrypt (Caddy menyediakan
> otomasi TLS via `tls { }` tanpa file cert manual).

### 3.5 Generate self-signed certificate plan

Untuk bare-IP, Caddy memerlukan *catch-all* `:443` (SNI tidak berfungsi untuk IP), bukan
situs `https://IP`. Caddyfile sudah disiapkan untuk pola ini (lihat `Caddyfile` di repo).

### 3.6 Jalankan

```bash
cd /opt/secchangelog
docker compose up -d --build
```

- `secchangelog-app` menjalankan entrypoint: `mkdir uploads → db:push → seed → bun server.js`
- `secchangelog-caddy` berjalan di port host `8086` (HTTP) dan `9445` (HTTPS)

### 3.7 Verifikasi

```bash
docker compose ps
curl -sk https://127.0.0.1:9445/api/health   # → {"status":"ok","db":"connected",...}
# Akses: https://10.0.106.233:9445 (login page)
```

POST `/api/upload` (dengan session admin) harus return `201`.

---

## 4. Docker Compose

```yaml
services:
  app:
    build: { context: ., dockerfile: Dockerfile }
    container_name: secchangelog-app
    restart: unless-stopped
    env_file: [ .env ]
    environment:
      HOSTNAME: "0.0.0.0"          # Wajib: Next standalone bind ke IP container jika dibiarkan
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    volumes:
      - secchangelog_data:/app/data          # SQLite
      - secchangelog_uploads:/app/public/uploads
    expose: [ "3000" ]

  caddy:
    image: caddy:2
    container_name: secchangelog-caddy
    restart: unless-stopped
    ports:
      - "8086:80"
      - "9445:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./certs:/certs:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [ app ]

volumes:
  secchangelog_data:
  secchangelog_uploads:
  caddy_data:
  caddy_config:
```

---

## 5. Reverse Proxy (Caddy)

`Caddyfile` (host port dipetakan karena port 80/443 sudah dipakai service lain):

```caddy
{
	admin off
}

:80 {
	redir https://10.0.106.233:9445{uri} permanent
}

:443 {
	tls /certs/fullchain.pem /certs/privkey.pem

	header {
		Strict-Transport-Security "max-age=63072000"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
	}

	handle {
		reverse_proxy app:3000
	}
}
```

---

## 6. Dockerfile (multi-stage)

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run db:generate && bun run build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
```

Entrypoint (`docker-entrypoint.sh`):

```sh
#!/bin/sh
set -e
mkdir -p /app/public/uploads/screenshots
mkdir -p /app/public/uploads/logos
cd /app
bun run db:push
bun run scripts/seed.ts      # idempotent: tidak menggandakan admin bila sudah ada
exec bun server.js
```

---

## 7. Rebuild setelah perubahan kode

```bash
cd /opt/secchangelog
# salin perubahan (pakai pscp / tar) dari local ke server dulu
docker compose up -d --build app
docker compose logs -f app
```

---

## 8. Backup & Restore

### 8.1 Backup

```bash
BACKUP=secchangelog-$(date +%F).tar.gz
docker run --rm -v secchangelog_data:/app/data -v secchangelog_uploads:/uploads \
  -v "$PWD":/backup alpine tar czf /backup/$BACKUP \
  -C /app/data . -C /uploads .
gpg --symmetric --cipher-algo AES256 $BACKUP   # optional
```

### 8.2 Restore

```bash
docker run --rm -v secchangelog_data:/app/data -v secchangelog_uploads:/uploads \
  -v "$PWD":/backup alpine tar xzf /backup/$BACKUP -C /
```

> Simpan `certs/` dan `docker-compose.yaml` dalam backup konfigurasi (30 hari retention).

---

## 9. Troubleshooting

| Gejala | Sebab & Solusi |
|--------|----------------|
| Halaman redirect balik ke `/login` terus | Bug cookie session (fixed): middleware butuh `cookieName: "next-auth.session-token"` + `secureCookie: true`. Pastikan sudah rebuild. |
| `bun run db:push` error di container | Pastikan berada di `/app` (bun resolve prisma relatif ke cwd) |
| Upload gagal | Cek volume `secchangelog_uploads`; path `UPLOAD_DIR=/app/public/uploads` di `.env` |
| TLS warning pada IP | Self-signed memang menimbulkan warning; gunakan domain + Let's Encrypt bila butuh trusted |
| Load tiap boot seed | Seed idempotent; tidak akan mengganti admin yang sudah ada |

---

## 10. Registrasi & Log

- Log: `docker compose logs -f app`
- Audit trail aplikasi di tabel SQLite `AuditTrail`
- Database di `/app/data/secchangelog.db` (volume `secchangelog_data`)

---

## 11. Checklist Go-Live

- [x] `docker compose ps` semua container status `Up`
- [x] `GET /api/health` → `{ status: "ok", db: "connected" }`
- [x] Login admin berhasil, dashboard tidak redirect loop
- [x] Upload screenshot + create change log bekerja
- [x] `NEXTAUTH_SECRET` & `LDAP_ENCRYPTION_KEY` acak & diamankan
- [x] Default admin password diganti setelah login pertama
- [x] Volume + env di-backup

---

## 12. Skalan/Evolusi

- **SQLite → MySQL**: ubah `provider` di `prisma/schema.prisma`, set `DATABASE_URL`,
  `prisma migrate deploy` (skema portabel).
- **Upload → S3**: ganti `file-storage.service.ts` dengan adapter S3.
- **Let's Encrypt**: ganti Caddyfile ke `domain.com { tls { email ... } }` bila ada domain.