# CLAUDE.md

Panduan untuk Claude Code saat bekerja di repo ini.

## Apa ini

Generator konten marketing (gambar + caption) untuk produk SaaS undangan
pernikahan digital.

Dua bagian dalam satu folder:

- **Frontend** `src/` — React + Vite + TypeScript, di-host statis.
- **Backend** `backend/Kode.gs` — Google Apps Script, satu berkas berisi
  seluruh backend. Database Google Spreadsheet, storage Google Drive.

Keduanya di-deploy terpisah dan hanya bertemu lewat HTTP. Cara menyiapkan
backend di akun Google baru ada di [`backend/README.md`](backend/README.md).

> **`backend/Kode.gs` adalah satu-satunya sumber backend.**
>
> Folder `../apps-script/` di luar folder ini berisi backend versi lama yang
> dulu terpecah jadi 11 berkas (`Main.gs`, `Api.gs`, `DriveStore.gs`, dan
> seterusnya). Isinya **tidak dipakai lagi dan tidak pernah dideploy.**
>
> Jangan mengedit apa pun di sana. Nama fungsinya nyaris identik dengan yang
> di `Kode.gs`, jadi pencarian teks di seluruh proyek akan menemukan keduanya —
> dan mengedit yang salah menghasilkan perubahan yang lolos semua pemeriksaan
> tapi tidak pernah sampai ke pengguna. Ini sudah pernah terjadi.
>
> Saat memberi instruksi deploy ke pengguna, sebut **satu berkas**:
> salin `backend/Kode.gs` ke editor Apps Script, lalu Deploy → Manage
> deployments → pensil → Version: New version.

**Status: berjalan.** Empat tab (Generate, Library, Kalender, Pengaturan)
berfungsi.

## Sebelum menulis kode

Baca dulu, berurutan:

1. [`docs/ARSITEKTUR.md`](docs/ARSITEKTUR.md) — batasan sistem dan alasan tiap
   keputusan. Beberapa hal terlihat seperti kekurangan padahal disengaja.
2. [`docs/PANDUAN-PENGEMBANGAN.md`](docs/PANDUAN-PENGEMBANGAN.md) — konvensi
   kode.
3. [`docs/API.md`](docs/API.md) — daftar action backend.

## Yang paling mudah salah

Tiga hal ini menyebabkan kegagalan yang sulit didiagnosis:

1. **`Content-Type` harus `text/plain`**, bukan `application/json`. Apps Script
   tidak bisa menjawab preflight CORS, jadi `application/json` diblokir browser
   tanpa pesan error yang jelas. `redirect: 'follow'` juga wajib.

2. **Alur produksi konten harus tetap 4 panggilan terpisah** (naskah → gambar →
   upload → simpan). Batas eksekusi Apps Script 6 menit. Jangan digabung.

3. **Renderer tidak boleh menyentuh React atau `api/`.** Ia modul murni yang
   menerima data + canvas. Kalau terikat React, pengujiannya mustahil.

## Konvensi singkat

- Nama variabel/fungsi **Inggris**, komentar dan teks UI **Indonesia**
- Komentar menjelaskan *kenapa*, bukan *apa*
- Dilarang `any`
- Semua panggilan backend lewat `src/api/`, tidak boleh `fetch` di komponen
- Satu fitur tidak boleh mengimpor fitur lain
- Commit message bahasa Indonesia: `feat: tambah filter pilar`

Daftar larangan lengkap ada di bagian 13 `PANDUAN-PENGEMBANGAN.md`.

## Struktur

```
src/
├── api/          satu-satunya lapisan yang tahu soal fetch
├── components/   komponen bersama
├── features/     satu folder per fitur, saling terisolasi
├── hooks/        hook bersama
├── lib/          utilitas murni, tanpa React
├── renderer/     mesin Canvas, tanpa React dan tanpa api/
├── types/        tipe bersama
└── styles/       token desain

backend/
├── Kode.gs       SELURUH backend, 11 bagian bernomor
├── appsscript.json
└── test-kode.cjs
```

Arah ketergantungan dan aturannya ada di `ARSITEKTUR.md` bagian 4.

## Perintah

```bash
npm run dev        # server pengembangan
npm run typecheck  # wajib lolos sebelum push
npm run lint
npm run test

cd backend && node test-kode.cjs   # wajib setelah menyentuh Kode.gs
```

## Menyentuh backend

`backend/Kode.gs` adalah gabungan 11 modul yang dulu terpisah. Dua aturan
membuatnya tetap bisa dimuat:

1. **Urutan bagian tidak boleh diubah.** Tiap bagian berupa `const Modul =
   (function(){...})()`; `const` tidak ter-hoist, jadi bagian 1 (KONFIGURASI)
   wajib paling atas.
2. **Dilarang memanggil modul lain di tingkat atas berkas** — mis. `const X =
   Config.secret(...)`. Bungkus dalam fungsi, karena saat berkas dimuat modul
   di bawahnya belum terdefinisi.

Jalankan `node backend/test-kode.cjs` setelah mengubahnya; ia menangkap kedua
pelanggaran itu, memeriksa `doGet` tetap tidak ada, dan memastikan tiap action
yang dipanggil `src/api/` punya handler.

Menambah action: fungsi `api*` di bagian 10 → daftarkan di `API_ROUTES` bagian
11 → catat di `docs/API.md`.

Tidak perlu menyentuh `test-kode.cjs`: daftar action dibaca otomatis dari
pemanggilan `call('nama', …)` di `src/api/`. Jadi begitu UI memanggil action
baru, tes langsung menuntut handlernya ada.

Backend ini murni API — **jangan menambahkan `doGet` atau `HtmlService`.**
Antarmukanya aplikasi React ini, bukan halaman yang disajikan Apps Script.

## Keamanan

`.env` tidak boleh ter-commit — sudah dicegah `.gitignore`, tapi tetap periksa
`git status` sebelum push.

Token di frontend hanya pembatas pemakaian, bukan rahasia — build statis selalu
bisa dibaca pengunjung. Semua API key AI tetap di Script Properties Apps
Script.
