# Cara Pakai

Panduan menjalankan aplikasi. Untuk menyiapkan backend-nya, lihat
[`DEPLOY-BACKEND.md`](DEPLOY-BACKEND.md).

---

## Menjalankan

```bash
cd kosa-smd-generator
npm install        # sekali saja
npm run dev
```

Buka `http://localhost:5173`.

> Kalau `.env` diubah, hentikan (`Ctrl+C`) lalu jalankan ulang. Vite membaca
> env hanya saat start — ini jebakan yang sering membingungkan.

---

## Urutan pemakaian pertama kali

1. **Tab Pengaturan** → kalau muncul kartu "Database belum siap", klik
   **Inisialisasi Database**
2. Masih di Pengaturan → isi **Identitas merek** (nama, handle IG, warna, font)
   → **Simpan merek**
3. Klik **Tes provider teks** dan **Tes provider gambar** untuk memastikan
   koneksi
4. **Tab Generate** → pilih format → **Generate**

---

## Tab Generate

Prosesnya empat langkah yang terlihat di layar:

| Langkah | Yang terjadi |
|---|---|
| 1. Naskah & caption | AI menyusun teks, hook, dan prompt gambar |
| 2. Gambar | Rantai fallback mengambil gambar |
| 3. Render | Browser menggambar tiap halaman |
| 4. Simpan | Upload ke Drive, catat ke spreadsheet |

Tiap langkah menampilkan provider mana yang dipakai, misalnya
`gemini gagal → cloudflare ✓`. **Itu informasi normal, bukan error** — kuota
habis memang sudah diantisipasi rancangan.

### Opsi lanjutan

**Lewati AI gambar** — memakai latar tipografi prosedural. Tidak menyentuh
kuota sama sekali, dan untuk konten edukasi sering justru lebih terbaca
daripada foto AI.

**Gambar berbeda tiap frame** (reels/shorts) — memakai kuota sebanyak jumlah
frame. Tanpa ini, satu gambar dipakai untuk semua frame.

---

## Tab Library

Daftar konten yang sudah dibuat. Klik satu kartu untuk melihat detail,
caption, dan mengubah statusnya:

`draft` → `ready` → `approved` → `posted`

Hanya konten berstatus **ready** yang muncul di pilihan penjadwalan.

### Menyunting tampilan

Tombol **Sunting teks & tampilan** membuka penyunting dengan pratinjau yang
menggambar ulang sendiri — tidak ada tombol "lihat hasil", setiap perubahan
langsung terlihat.

Yang bisa diatur:

| Bagian | Keterangan |
|---|---|
| Teks per halaman | Judul dan isi tiap halaman |
| Pasangan font | Dua font yang sudah serasi, sekali klik |
| Font judul & isi | Pilih sendiri; tiap nama tampil dengan huruf aslinya |
| Posisi & perataan | Letak blok teks di atas gambar |
| Ukuran teks | Pengali, 70%–140% |
| Kegelapan foto | Naikkan kalau teks putih sulit terbaca |

Pada carousel, yang digambar adalah **halaman yang sedang dilihat**. Pindah
halaman lewat deretan nomor di bawah kanvas, atau dengan mengklik nomor di
sebelah kotak teksnya.

Menyunting sama sekali tidak memakai kuota AI — gambarnya diambil dari yang
sudah tersimpan. Tidak ada yang berubah di Drive maupun spreadsheet sampai
**Simpan perubahan** ditekan.

> Font yang diganti di sini hanya berlaku untuk konten itu. Untuk mengubah font
> semua konten, ubah di tab Pengaturan.

---

## Tab Kalender

Melihat jadwal publikasi per bulan dan menjadwalkan konten baru.

---

## Kenapa lambat?

Waktu respons backend sangat bervariasi:

| Provider | Waktu khas |
|---|---|
| Groq | ~300 ms |
| Gemini | 2–3 detik |
| Cloudflare (gambar) | ~2 detik |
| Pollinations | 35–45 detik |
| OpenRouter | bisa >200 detik saat antre |

Ini batas tier gratis, bukan masalah aplikasi. Kalau sedang terburu-buru,
centang **Lewati AI gambar** — langkah 2 jadi seketika.

---

## Membangun untuk produksi

```bash
npm run build      # hasil di dist/
npm run preview    # pratinjau hasil build
```

Isi `dist/` bisa di-host di GitHub Pages, Cloudflare Pages, atau Vercel.

Untuk GitHub Pages yang menyajikan dari subpath, set `VITE_BASE_PATH`:

```bash
VITE_BASE_PATH=/nama-repo/ npm run build
```

> **Ingat:** token di `.env` ikut masuk ke hasil build dan bisa dibaca siapa
> pun yang membuka halaman. Itu memang sifat frontend statis — token hanya
> pembatas pemakaian, bukan rahasia. API key AI tetap aman di Script
> Properties.

---

## Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run typecheck` | Periksa tipe, wajib lolos sebelum push |
| `npm run test` | Jalankan seluruh pengujian |
| `npm run test:watch` | Pengujian mode pantau |
| `npm run lint` | Periksa gaya kode |

---

## Kalau macet

| Gejala | Perbaikan |
|---|---|
| Halaman kosong | Buka console browser; biasanya `.env` belum diisi |
| `Token tidak sah` | Samakan `VITE_API_TOKEN` dengan Script Property `API_TOKEN` |
| `Balasan server bukan JSON` | Deploy ulang Apps Script: Manage deployments → New version |
| Error CORS di console | Pastikan akses deployment "Anyone" |
| Gambar Library tidak muncul | Thumbnail Drive butuh sesi login Google — lihat ARSITEKTUR.md bagian 7 |
| Perubahan `.env` tidak terbaca | Hentikan dan jalankan ulang `npm run dev` |
