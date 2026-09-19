# Kosa SMD Generator

Antarmuka web untuk generator konten marketing (gambar + caption) produk SaaS
undangan pernikahan digital.

React + Vite + TypeScript. Backend-nya Google Apps Script, dengan Google
Spreadsheet sebagai database dan Google Drive sebagai penyimpanan gambar.

> **Status:** berjalan. Empat tab (Generate, Library, Kalender, Pengaturan)
> sudah berfungsi. Lihat [`docs/CARA-PAKAI.md`](docs/CARA-PAKAI.md) untuk
> mulai, dan [`docs/`](docs/) untuk rancangan sebelum menambah fitur.

---

## Arsitektur singkat

```
  React + Vite  (repo ini)
        │
        │  fetch POST, Content-Type: text/plain
        │  body: { action, payload, token }
        ▼
  Apps Script  doPost router
        │
        ├──►  Google Spreadsheet   (database)
        ├──►  Google Drive         (gambar)
        └──►  Rantai AI            (Gemini / Cloudflare / Groq / …)
```

Repo ini berisi **keduanya**: antarmuka di `src/`, dan backend Apps Script
dalam satu berkas di [`backend/Kode.gs`](backend/Kode.gs). Keduanya di-deploy
terpisah dan hanya bertemu lewat HTTP.

**Kenapa Apps Script sebagai backend?** Gratis selamanya tanpa kartu kredit,
akses native ke Sheets & Drive tanpa service account, dan tidak ada server yang
perlu dirawat atau bisa ditarik kembali penyedianya.

---

## Menjalankan secara lokal

Butuh Node.js 20+.

```bash
npm install
cp .env.example .env    # lalu isi nilainya
npm run dev
```

Isi `.env` dengan URL web app Apps Script dan token. Keduanya dijelaskan di
`.env.example`.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi ke `dist/` |
| `npm run preview` | Pratinjau hasil build |
| `npm run typecheck` | Periksa tipe TypeScript |
| `npm run lint` | Periksa gaya kode |
| `npm run test` | Jalankan pengujian |
| `cd backend && node test-kode.cjs` | Uji backend sebelum deploy |

---

## Struktur folder

```
src/
├── api/          Lapisan pemanggilan backend — satu-satunya yang tahu soal fetch
├── components/   Komponen UI yang dipakai bersama (tombol, dialog, dll)
├── features/     Satu folder per fitur: generate, library, kalender, pengaturan
├── hooks/        Hook React yang dipakai bersama
├── lib/          Utilitas murni tanpa ketergantungan React
├── renderer/     Mesin Canvas: layout, text-wrap, ekspor gambar
├── types/        Definisi tipe bersama
└── styles/       Token desain dan gaya global

backend/
├── Kode.gs           Seluruh backend Apps Script dalam satu berkas
├── appsscript.json   Manifest
└── test-kode.cjs     Pengujian sebelum deploy
```

Aturan ketergantungan dan alasannya ada di
[`docs/PANDUAN-PENGEMBANGAN.md`](docs/PANDUAN-PENGEMBANGAN.md).

---

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [`docs/CARA-PAKAI.md`](docs/CARA-PAKAI.md) | Menjalankan dan memakai aplikasi |
| [`docs/DEPLOY-BACKEND.md`](docs/DEPLOY-BACKEND.md) | Menyiapkan Apps Script sebagai backend |
| [`docs/ARSITEKTUR.md`](docs/ARSITEKTUR.md) | Rancangan sistem, batasan, dan alasan tiap keputusan |
| [`docs/PANDUAN-PENGEMBANGAN.md`](docs/PANDUAN-PENGEMBANGAN.md) | Konvensi kode yang wajib diikuti |
| [`docs/API.md`](docs/API.md) | Daftar action backend dan bentuk datanya |

---

## Keamanan

**Jangan pernah commit file `.env`.** Sudah dicegah lewat `.gitignore`, tapi
tetap periksa sebelum push.

Token di `.env` hanya membatasi pemakaian, bukan rahasia tingkat tinggi —
frontend statis selalu bisa dibaca pengunjung. Jangan taruh apa pun yang benar-
benar sensitif di sini. Semua API key AI tetap tersimpan di Script Properties
Apps Script, tidak pernah menyentuh repo ini.
