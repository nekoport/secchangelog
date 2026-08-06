# SecChangeLog - Installation Guide

## Quick Start (Development)

```bash
# 1. Install dependencies
bun install

# 2. Copy env template and edit
cp .env.example .env
# Edit .env with your values (especially NEXTAUTH_SECRET)

# 3. Setup database (SQLite for dev)
bun run db:push

# 4. Seed default admin & device types
bun run scripts/seed.ts

# 5. Start dev server
bun run dev
```

Open http://localhost:3000 and login with:
- Email: admin@secchangelog.local
- Password: Admin@12345

## Production Deployment

See `docs/06-Deployment-Guide.md` or `documentation/06-Deployment-Guide.md` for complete production setup.

## Switch to MySQL

1. Edit `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "mysql"
     url      = env("DATABASE_URL")
   }
   ```

2. Update `DATABASE_URL` in `.env`

3. Run migration:
   ```bash
   bun run db:migrate --name init
   ```

## Documentation

All documentation is in:
- `docs/` - Markdown source files
- `documentation/` - Complete documentation (MD + PDF + screenshots)

## Security Audit

```bash
bun run scripts/security-audit.ts
```

## Default Credentials

⚠️ CHANGE PASSWORD AFTER FIRST LOGIN!

- Email: admin@secchangelog.local
- Password: Admin@12345
