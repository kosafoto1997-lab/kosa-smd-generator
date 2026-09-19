# Backend — Kosa SMD Generator

Kode Google Apps Script yang melayani aplikasi React di folder induk.

Seluruh backend ada dalam **satu berkas**, [`Kode.gs`](Kode.gs), supaya
perbaikan cukup menyentuh satu tempat dan penyalinan ke editor Apps Script
tidak perlu mencocokkan nama berkas satu per satu.

| Berkas | Isi |
|---|---|
| `Kode.gs` | Seluruh backend: 11 bagian bernomor, ~3.400 baris |
| `appsscript.json` | Manifest: timezone, oauthScopes, setelan webapp |
| `test-kode.cjs` | Pembuktian `Kode.gs` benar-benar jalan sebelum di-deploy |

Backend ini **murni API**. Tidak ada `doGet`, tidak menyajikan HTML sama
sekali. Antarmukanya aplikasi React yang di-host terpisah (Netlify, Vercel,
GitHub Pages — mana saja).

---

## Deploy ke akun Gmail baru

Sepuluh menit, tanpa kartu kredit. Ikuti berurutan.

### 1. Siapkan Spreadsheet dan folder Drive

Masuk ke akun Gmail yang baru, lalu:

1. Buat spreadsheet kosong di [sheets.new](https://sheets.new). Beri nama bebas.
   Salin **ID**-nya dari URL — bagian antara `/d/` dan `/edit`:

   ```
   https://docs.google.com/spreadsheets/d/1AbC...XyZ/edit
                                          ^^^^^^^^^^ ini ID-nya
   ```

2. Buat folder di [drive.google.com](https://drive.google.com), misalnya
   `Konten Marketing`. Buka foldernya, salin **ID** dari URL — bagian setelah
   `/folders/`.

Simpan dua ID itu, sebentar lagi dipakai.

### 2. Buat project Apps Script

1. Buka [script.new](https://script.new) — sedang masuk sebagai akun baru.
2. Beri nama project, misalnya `Kosa SMD Backend`.
3. Hapus seluruh isi `Code.gs` bawaan, lalu **tempel seluruh isi
   [`Kode.gs`](Kode.gs)**.
4. Klik ikon gerigi **Project Settings**, centang
   *"Show appsscript.json manifest file in editor"*.
5. Kembali ke **Editor**, buka `appsscript.json` yang sekarang muncul, ganti
   isinya dengan isi [`appsscript.json`](appsscript.json) di folder ini.
6. Simpan (Ctrl+S).

### 3. Isi Script Properties

**Project Settings → Script Properties → Add script property.**

Wajib diisi, jika tidak backend menolak melayani:

| Properti | Isi |
|---|---|
| `SPREADSHEET_ID` | ID dari langkah 1.1 |
| `DRIVE_ROOT_FOLDER_ID` | ID dari langkah 1.2 |
| `API_TOKEN` | Token acak buatan sendiri — lihat di bawah |

Buat `API_TOKEN` yang acak, minimal 32 karakter:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Nilainya **harus sama persis** dengan `VITE_API_TOKEN` di `.env` frontend.

Kunci AI bersifat opsional — tanpa satu pun, aplikasi tetap menghasilkan
konten lewat lapisan terakhir yang tidak memanggil jaringan:

| Properti | Untuk |
|---|---|
| `GEMINI_API_KEY` | Gambar + teks (paling utama) |
| `GROQ_API_KEY` | Teks |
| `OPENROUTER_API_KEY` | Teks |
| `CF_ACCOUNT_ID`, `CF_API_TOKEN` | Gambar + teks |

### 4. Isi database

Di editor, pilih fungsi **`initDatabase`** pada menu dropdown, klik **Run**.

Google akan meminta izin pada jalan pertama: *Review permissions* → pilih akun
→ *Advanced* → *Go to ... (unsafe)* → *Allow*. Peringatan itu normal untuk
script milik sendiri yang belum diverifikasi Google.

Selesai jika Execution log menampilkan tab-tab yang dibuat. Fungsi ini aman
dijalankan berulang kali — hanya menambah yang belum ada.

### 5. Deploy sebagai web app

**Deploy → New deployment → ⚙ → Web app**, lalu isi:

| Kolom | Nilai |
|---|---|
| Execute as | **Me** |
| Who has access | **Anyone** |

> **"Anyone" itu wajib, dan tetap aman.** Tanpa itu, panggilan dari browser
> dibalas halaman login HTML, bukan JSON — aplikasi gagal total dengan pesan
> *"Balasan server bukan JSON"*. Pintu masuknya tetap dijaga `API_TOKEN`:
> permintaan tanpa token yang benar langsung ditolak. Kuota AI tetap memakai
> akun Anda, tidak bisa dipakai orang lain.

Salin **Web app URL** yang muncul.

### 6. Hubungkan ke frontend

Di folder induk, buat `.env`:

```
VITE_APPS_SCRIPT_URL=<Web app URL dari langkah 5>
VITE_API_TOKEN=<API_TOKEN yang sama dengan langkah 3>
```

Lalu `npm run dev`. Aplikasi memanggil `ping` saat dibuka — kalau tab
Pengaturan tidak menampilkan error koneksi, sambungan sudah benar.

---

## Memperbarui setelah mengubah kode

Tempel ulang `Kode.gs`, lalu:

**Deploy → Manage deployments → ikon pensil → Version: New version → Deploy.**

> Jangan memilih **New deployment** — itu membuat URL baru dan `.env` frontend
> jadi menunjuk deployment lama yang tidak ikut berubah.

---

## Menguji sebelum deploy

```bash
cd backend
node test-kode.cjs
```

Exit 0 kalau lolos. Yang diperiksa: berkas bisa dimuat (urutan bagian benar,
tidak ada nama bentrok), seluruh modul terdefinisi, `doGet` benar-benar sudah
tidak ada, router menolak token salah, dan ke-26 action yang dipanggil React
punya handler.

Tes ini tidak menyentuh jaringan, spreadsheet asli, maupun kuota AI — ia
memuat `Kode.gs` ke sandbox berisi tiruan layanan Google.

---

## Peta isi `Kode.gs`

Tekan Ctrl+F lalu ketik penandanya, misalnya `== 11`.

| Penanda | Bagian | Isi |
|---|---|---|
| `== 1` | KONFIGURASI | Tetapan global, `Config.secret()`, `Util` |
| `== 2` | SKEMA | Definisi tab + data awal + `initDatabase()` |
| `== 3` | SHEETDB | Satu-satunya yang menyentuh `SpreadsheetApp` |
| `== 4` | KUOTA | Pemakaian harian + circuit breaker |
| `== 5` | PROMPT | Penyusun prompt + validator soft-selling |
| `== 6` | AI GAMBAR | gemini → cloudflare → pollinations → local |
| `== 7` | AI TEKS | gemini → groq → openrouter → cloudflare → template |
| `== 8` | DRIVE | Penyimpanan gambar |
| `== 9` | PIPELINE | Perakit alur produksi konten |
| `== 10` | FUNGSI API | Seluruh fungsi `api*` |
| `== 11` | ROUTER HTTP | `doPost`, pemeriksaan token, peta action |

### Urutan bagian tidak boleh diubah

Tiap bagian berupa `const NamaModul = (function(){...})()`. JavaScript
menjalankannya berurutan dari atas dan `const` tidak ter-hoist, jadi bagian 1
(KONFIGURASI) wajib paling atas karena dipakai semua bagian lain.

Ini aman selama tidak ada modul yang memanggil modul lain saat berkas dimuat.
Jaga sifat itu: **jangan menulis `const X = Config.secret(...)` di tingkat atas
berkas** — bungkus dalam fungsi. `test-kode.cjs` akan menangkap pelanggarannya.

### Menambah action baru

1. Tulis `apiNamaBaru()` di bagian 10, bungkus dengan `wrap_()` supaya klien
   menerima `{ok, data}` atau `{ok, error}` — tidak pernah exception mentah.
2. Daftarkan satu baris di `API_ROUTES`, bagian 11.
3. Tambahkan namanya ke `DIPAKAI_UI` di `test-kode.cjs`.
4. Catat di `docs/API.md`.

---

## Kalau bermasalah

| Gejala | Sebab yang paling sering |
|---|---|
| *"Balasan server bukan JSON"* | Access bukan **Anyone**, atau deployment belum diperbarui ke versi baru |
| *"Token tidak sah"* | `API_TOKEN` dan `VITE_API_TOKEN` berbeda — periksa spasi ikut tersalin |
| *"Script Property ... belum diisi"* | Langkah 3 terlewat |
| Pratinjau gambar kosong | Jalankan `shareAllImages` dari tab Pengaturan |
| *"Terlalu banyak permintaan"* | Batas 120 panggilan/jam; tunggu pergantian jam |

Log lengkap ada di **Executions** pada editor Apps Script.
