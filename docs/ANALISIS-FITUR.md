# Analisis Fitur — Apa yang Kurang

Perbandingan project ini dengan tool sejenis (Buffer, Later, Metricool, Publer,
SocialBee, ContentStudio, Predis, Ocoya, Canva) per September 2026.

Disusun dari riset fitur dan keluhan pengguna nyata, bukan daftar keinginan.

> **Status per 15 September 2026 — sebagian besar dokumen ini sudah usang.**
>
> Audit kode menunjukkan **Prioritas 1 dan 2 sudah selesai seluruhnya**, dan
> ke-26 action backend kini terpakai di UI. Keluhan utama dokumen ini —
> "delapan fitur jadi tapi tidak ada tombolnya" — **tidak berlaku lagi**.
>
> Yang benar-benar masih kosong:
>
> | Celah | Catatan |
> |---|---|
> | Unduh gambar | Tidak ada satu pun tombol unduh di seluruh aplikasi, padahal ini langkah wajib sebelum posting |
> | Kalender visual | Masih tabel datar: tanpa tampilan bulanan, penanda hari ini, atau daftar jatuh tempo |
> | Kolom performa | `CONTENT` belum punya kolom metrik. `PUBLISH_LOG` sudah punya `posted_at` dan `link` |
>
> Bagian di bawah dipertahankan sebagai catatan riset awal.

---

## Ringkasan: posisi project ini

**Yang sudah kuat dan jarang dimiliki pesaing:**

| Keunggulan | Catatan |
|---|---|
| Rantai fallback AI berlapis | Tidak ada tool lain yang menjamin konten tetap terbit saat semua API mati |
| Content pillars dengan bobot | Hanya SocialBee yang punya sematang ini |
| Aturan soft-selling ditanam di prompt | **Tidak ada tool lain yang punya** — ini pembeda nyata |
| Rotasi hashtag anti-spam | Jarang ada |
| Biaya Rp 0 | Pesaing $15–250/bulan |

**Kelemahan terbesar:** delapan fitur sudah jadi di backend tapi **tidak ada
tombolnya di UI** — pekerjaan yang sudah selesai tapi tidak bisa dipakai.

---

## BAGIAN 1 — Sudah jadi, tinggal disambungkan

Ini prioritas tertinggi: biayanya kecil, manfaatnya langsung.

| Fitur | Action backend | Nilai yang terbuang |
|---|---|---|
| **Render ulang tanpa AI** | `getRawImage` | Gambar mentah tersimpan di `99_Raw_AI`. Bisa ganti teks lalu render ulang **tanpa menyentuh kuota sama sekali**. Ini fitur hemat kuota paling berharga di sistem, dan sepenuhnya tidak terjangkau |
| **Bank ide** | `generateIdeas`, `listIdeas` | AI bisa menghasilkan 5–10 ide per pilar sebagai backlog. Database sudah berisi 8 ide yang tidak pernah terlihat |
| **Bank hashtag** | `listHashtags`, `addHashtag`, `deleteHashtag` | Rotasi otomatis berbasis "paling lama tidak dipakai" sudah jalan di belakang layar, tapi isinya tidak bisa dilihat atau diubah |
| **Edit caption** | `updateCaption` | Perbaiki caption manual, otomatis dibersihkan dari kata terlarang |
| **Status kuota** | `getQuotaStatus` | Pemantauan tanpa memuat ulang seluruh bootstrap |

**Perkiraan: 1–2 hari kerja untuk semuanya.**

---

## BAGIAN 2 — Fitur baseline yang benar-benar hilang

Riset menemukan sembilan fitur yang ada di **100% tool pembanding**. Project
ini belum punya empat di antaranya.

### 2.1 Grid preview Instagram — **paling berdampak**

Semua tool punya ini, dan riset menyebut estetika feed sebagai **alasan utama
UMKM memakai tool sama sekali**.

Tanpa ini, tidak ada cara melihat apakah post baru serasi dengan yang sudah
ada. Untuk merek undangan pernikahan yang menjual keindahan visual, ini
kelemahan yang terasa.

> Biayanya rendah: data `thumb` sudah tersedia di `listContent`. Yang perlu
> dibuat hanya tata letak grid 3 kolom.

### 2.2 Media library dengan tag dan pencarian

Library sekarang hanya bisa disaring per status, format, dan pilar. Tidak ada:

- Pencarian teks
- Tag bebas
- Penanda mana yang sudah/belum dipakai

Later punya detail kecil yang berguna: filter berdasarkan **status terpakai**.

### 2.3 Duplikasi konten

Ada di semua tool. Belum ada di sini.

Kegunaan nyata: ambil konten yang berhasil, ubah topiknya sedikit, terbitkan
lagi. Tanpa duplikasi, setiap konten harus dimulai dari nol.

### 2.4 Analitik dasar

**Tidak ada tempat menyimpan performa** di seluruh skema data. Tidak ada kolom
untuk likes, reach, saves, atau komentar.

Akibatnya rasio pilar (45/25/20/10) hanya berdasarkan **dugaan**, bukan bukti.
Tidak ada cara tahu pilar mana yang sebenarnya berhasil.

> Ini membutuhkan kolom baru di sheet `CONTENT` — perubahan skema, bukan
> sekadar UI.

---

## BAGIAN 3 — Yang tidak perlu dikejar

Riset ini juga berguna untuk memutuskan apa yang **tidak** dibangun.

### 3.1 Auto-posting: hampir mustahil, dan tidak sepadan

Temuan paling penting dari riset. Batasan API-nya keras:

**Instagram:**

| Format | Bisa auto-post? |
|---|---|
| Feed foto tunggal | ✅ |
| Carousel | ✅ tapi maksimal **10 slide** |
| Reels | ⚠️ gagal kalau pakai musik berlisensi / efek AR |
| **Stories** | ⚠️ auto-post **menghapus semua sticker interaktif** |
| Video ke feed | ❌ API memaksa jadi Reels |

Batas 25 post/hari, dan **wajib akun Business** — akun Creator dan Personal
tidak bisa sama sekali.

**TikTok lebih ketat:** tidak ada parameter penjadwalan sama sekali di API.
Semua konten dari aplikasi yang belum lolos audit **dikunci jadi private**.
Audit itu makan waktu berminggu-minggu.

Sebuah review yang menguji langsung menemukan: **tidak ada satu pun dari empat
tool yang diuji bisa auto-publish semua format** — semuanya jatuh ke
notifikasi manual untuk setidaknya satu format yang diposting mingguan.

**Kesimpulan:** jangan kejar auto-posting. Yang sepadan dibangun adalah
**alur pengingat yang rapi** — dan itu justru murah:

- Notifikasi saat waktunya posting
- Caption siap disalin satu klik
- Gambar siap diunduh
- Tandai "sudah diposting"

Riset menegaskan reminder **bukan fitur kelas dua** — bahkan tool terbaik pun
membutuhkannya.

### 3.2 Yang berlebihan untuk skala ini

Social listening, influencer discovery, approval berlapis, white-label
reporting, sentiment analysis, unified inbox.

---

## BAGIAN 4 — Keunggulan yang sudah dimiliki tapi belum ditonjolkan

Riset menemukan keluhan nomor satu tentang AI di 2026:

> **"Semuanya terdengar sama."** 30% profesional menyebut hasil AI terasa
> repetitif. 52% konsumen jadi kurang engaged begitu curiga konten dibuat AI.

Dan temuan penting: **tidak satu pun tool pembanding menangani ini** — brand
kit yang mereka punya soal *visual*, bukan *suara*.

Project ini sudah punya penangkalnya:

- `forbidden_words` — daftar kata terlarang yang divalidasi
- Aturan soft-selling ditanam permanen di system prompt
- `tone` dan `audience` per merek
- Pembersih caption otomatis

**Yang kurang hanya memperlihatkannya ke pengguna.** Misalnya notifikasi
"3 kata terlarang dibersihkan otomatis" setelah generate — data `sanitized`
sudah dikembalikan backend tapi belum ditampilkan.

---

## BAGIAN 5 — Prioritas

Urut berdasarkan **manfaat dibagi biaya**, bukan sekadar keinginan.

### Prioritas 1 — sudah jadi, tinggal disambung ✅ SELESAI

- [x] Tombol **render ulang tanpa AI** di detail Library
- [x] Tab/panel **Bank ide** — lihat, generate, pakai untuk topik
- [x] Panel **Bank hashtag** — lihat, tambah, hapus
- [x] **Edit caption** di detail Library
- [x] Tampilkan peringatan `sanitized` setelah generate

### Prioritas 2 — baseline yang hilang ✅ SELESAI

- [x] **Grid preview Instagram**
- [x] **Duplikasi konten**
- [x] **Pencarian teks** di Library
- [x] **Salin caption** di Library

### Prioritas 3 — alur pengingat (masih kosong)

- [x] Tandai status dengan sekali klik
- [ ] **Tombol unduh gambar** — belum ada di mana pun, padahal wajib untuk posting
- [ ] Daftar "jatuh tempo hari ini" di Kalender
- [ ] Kalender visual bulanan, bukan tabel datar

### Prioritas 4 — butuh perubahan skema (masih kosong)

- [ ] Kolom performa di sheet `CONTENT` (likes, reach, saves)
- [ ] Input manual angka performa
- [ ] Ringkasan performa per pilar → dasar nyata untuk menyetel rasio

> Sebelum membangun Prioritas 4, periksa dulu apakah input metrik manual
> benar-benar dipakai orang dalam jangka panjang — tool sejenis melaporkan
> fitur ini sering ditinggalkan setelah beberapa minggu.

### Tidak direkomendasikan

- ❌ Auto-posting Instagram/TikTok — lihat Bagian 3.1
- ❌ Unified inbox, social listening, approval berlapis

---

## Sumber

Riset dirangkum dari dokumentasi resmi API dan review pengguna:

- [Instagram Reels API Publishing Guide](https://postproxy.dev/blog/instagram-reels-api-publishing-guide/)
- [Instagram Carousel Posts Guide](https://socialrails.com/blog/instagram-carousel-posts-guide)
- [TikTok Content Posting API 2026](https://www.postpeer.dev/blog/best-tiktok-posting-api)
- [TikTok API: private-only until audited](https://vorplabs.com/agent-tools/tiktok-content-posting-api)
- [Buffer Features](https://buffer.com/resources/buffer-features/)
- [Later Review 2026](https://www.authencio.com/blog/later-review-is-it-still-the-best-creator-tool)
- [Publer Review 2026](https://bloggingwizard.com/publer-review/)
- [Metricool Review 2026](https://bloggingwizard.com/metricool-review/)
- [SocialBee: Content Categories](https://socialbee.com/blog/best-social-media-management-tools/)
- [Canva Scheduler: What It Does and Its Limits](https://postory.io/blog/canva-social-media-scheduler-review)
- [10 Common AI Social Media Tool Complaints](https://sozee.ai/resources/common-complaints-ai-social-tools/)
- [Social Media Scheduling Tools Tested](https://www.lilachbullock.com/social-media-scheduling-tools-tested-review/)
