# Distipline — kompyuterda ishga tushirish

Lokal zip: `docs/distipline-app-local.zip` (GitHub yo‘q — faqat zip).

## Talablar

- **Node.js 20+** (`node -v`)
- npm (Node bilan keladi)

## Qadamlar

```bash
# 1) Zipni oching
unzip distipline-app-local.zip
cd distipline-app

# 2) Paketlarni o‘rnating
npm install

# 3) Dev server (lokal PGlite — DATABASE_URL bo‘lmasin)
env -u DATABASE_URL -u DATABASE_URL_UNPOOLED npm run dev

# 4) Brauzer
# http://localhost:3000
```

Windows (PowerShell) uchun 3-qadam o‘rniga:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL_UNPOOLED -ErrorAction SilentlyContinue
npm run dev
```

## Eslatmalar

- Ma’lumotlar `.data/pglite` ichida saqlanadi (birinchi ishga tushirishda yaratiladi).
- Hosted/production (Vercel) uchun `AUTH_SECRET` va `DATABASE_URL` majburiy — `.env.example` ga qarang. Lokalda `AUTH_SECRET` ixtiyoriy (jarayon vaqtinchalik kalit yaratadi).
- Port band bo‘lsa: `npx next dev --port 3001`.
- `node_modules`, `.data`, `.next` zipga kiritilmagan — `npm install` majburiy.

## Vercel + Neon (telefon sync)

1. Neon: https://console.neon.tech → Create project → copy **Connection string** (va Direct agar ko‘rsatilsa).
2. Vercel: https://vercel.com/new → Import `SobirjonovBobir/distipline` → Environment Variables:
   - `AUTH_SECRET` = `openssl rand -base64 32` natijasi
   - `DATABASE_URL` = Neon pooled URL
   - `DATABASE_URL_UNPOOLED` = Neon direct URL (ixtiyoriy, migratsiya uchun yaxshi)
3. Deploy. Build `npm run build` ichida `scripts/migrate.mjs` ni ishga tushiradi.
4. Tekshiruv: `curl -sI https://<project>.vercel.app` → 200 va HTML da **Discipline** (Cursor apps-gate emas).

## Tekshiruv

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
# 200 bo‘lishi kerak
```
