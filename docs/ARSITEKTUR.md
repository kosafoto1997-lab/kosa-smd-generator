# Arsitektur

Keputusan rancangan beserta alasannya. Baca ini sebelum menambah fitur besar —
beberapa batasan di sini terlihat seperti kekurangan padahal disengaja.

---

## 1. Bentuk sistem

```
  React + Vite (statis, GitHub Pages / Cloudflare Pages)
        │
        │  fetch POST, Content-Type: text/plain
        │  body: { action, payload, token }
        ▼
  Apps Script  doPost  →  router  →  fungsi domain
        │
        ├──►  Spreadsheet   (database)
        ├──►  Drive         (gambar)
        └──►  Rantai AI     (Gemini → Cloudflare → Groq → … → lokal)
```

Frontend sepenuhnya statis. Tidak ada server render, tidak ada API route
sendiri. Semua logika bisnis ada di Apps Script.

---

## 2. Tiga batasan yang membentuk semua keputusan

Batasan ini datang dari Apps Script dan **tidak bisa ditawar**. Hampir setiap
keputusan aneh di dokumen ini berakar pada salah satunya.

### 2.1 CORS — tidak bisa mengirim header kustom

Apps Script tidak bisa mengirim `Access-Control-Allow-Origin`. Akibatnya:

- `POST` dengan `Content-Type: application/json` **diblokir browser** karena
  memicu preflight `OPTIONS` yang tidak bisa dijawab Apps Script.
- Harus dikirim sebagai `text/plain` — termasuk "simple request" sehingga lolos
  tanpa preflight. Isinya tetap JSON, hanya labelnya berbeda.
- **Tidak boleh ada header `Authorization`** (juga memicu preflight). Token
  ikut di dalam body.
- `redirect: 'follow'` wajib — Apps Script selalu membalas `302` ke
  `script.googleusercontent.com` sebelum memberi isi sebenarnya.

```ts
// BENAR
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action, payload, token }),
  redirect: 'follow',
});

// SALAH — diblokir browser, tanpa pesan error yang jelas
headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
```

### 2.2 Batas eksekusi 6 menit

Satu request Apps Script maksimal 6 menit. Carousel 7 halaman yang dikerjakan
sekaligus **pasti timeout**.

Karena itu produksi konten dipecah jadi empat panggilan terpisah:

```
1. generateText     naskah + caption + prompt gambar
2. fetchImage       ambil satu gambar (diulang per halaman)
3. uploadRendered   simpan satu hasil render
4. saveContent      catat ke spreadsheet
```

**Jangan menggabungkan langkah ini** hanya karena `fetch` terasa lebih bebas
daripada `google.script.run`. Batasnya tetap sama.

### 2.3 Render harus di browser

Apps Script tidak punya Canvas. Browser punya. Karena itu `src/renderer/`
berjalan sepenuhnya di klien.

Konsekuensi penting: **gambar diambil di server, bukan di browser.** Kalau
browser memuat URL gambar eksternal langsung ke `<img>` lalu menggambarnya ke
canvas, canvas akan ter-*taint* dan `toDataURL()` gagal. Server mengambil
gambar lalu mengirimnya sebagai data URL.

### 2.4 Dua jalur render, sengaja terpisah

Renderer punya dua pintu masuk, dan menggabungkannya akan merusak salah satu:

| | `renderAll()` | `drawPage()` |
|---|---|---|
| Dipakai | Menyimpan, render ulang | Pratinjau penyunting |
| Cakupan | Semua halaman | Satu halaman |
| Hasil | Data URL JPEG | Piksel di canvas yang terlihat |
| Gambar | Dimuat tiap panggilan | Diterima sudah jadi |

Pratinjau harus terasa seketika, jadi ia tidak boleh menanggung apa pun yang
mahal: tidak ada `toDataURL` (puluhan milidetik di 1080×1350), tidak ada
pemuatan ulang gambar, dan tidak menggambar halaman yang tidak terlihat.

Sebaliknya penyimpanan **wajib** menggambar ulang semuanya dari awal, supaya
yang tersimpan pasti cocok dengan setelan terakhir walau pratinjaunya sudah
usang. Jangan menyimpan hasil pratinjau.

Keduanya memilih layout dengan aturan yang sama persis. Kalau salah satunya
diubah, ubah keduanya — pratinjau yang berbeda dari berkas tersimpan lebih
buruk daripada tidak ada pratinjau.

### 2.5 Canvas tidak menggambar ulang sendiri

Dua sifat canvas yang menentukan bentuk kode penyunting:

**Font.** `fillText` menulis piksel sekali jalan; tidak ada ikatan hidup ke
font seperti di DOM. Saat font selesai diunduh, canvas tetap menampilkan
gambar lama — jadi renderer **harus** menggambar ulang sendiri setelah
`ensureFonts()` selesai. Font yang diminta juga harus disebut lengkap dengan
ukurannya (`700 92px "Lora"`); nama telanjang ditolak dengan `SyntaxError`.

**Penjadwalan.** Slider menyala jauh lebih sering daripada layar menyegarkan
diri. `createScheduler` menggabungkan permintaan jadi satu gambar per frame
dengan aturan "yang terakhir menang" — pola yang sama dipakai Konva, Fabric,
dan Excalidraw. Sengaja bukan debounce: debounce menunda gambar sampai gerakan
berhenti, sehingga pratinjau terasa tertinggal saat diseret.

---

## 3. Satu endpoint, bukan banyak

Backend mengekspos **satu** endpoint yang menerima `{ action, payload, token }`.

Alasannya bukan kemalasan:

- Apps Script `doPost` memang hanya satu fungsi — tidak ada konsep routing path
- Fungsi `api*` tidak perlu tahu soal HTTP sama sekali; router cuma lapisan
  tipis di atasnya
- Menambah action baru = menambah satu baris di peta router

Di sisi klien, seluruh aplikasi memanggil backend lewat **satu fungsi** di
`src/api/client.ts`. Tidak ada `fetch` lain di mana pun.

Kenapa penting: kalau suatu hari backend pindah dari Apps Script ke Postgres
atau Cloudflare Workers, **hanya file itu yang berubah**. Seluruh UI tidak
tersentuh.

---

## 4. Lapisan dan arah ketergantungan

```
features/  ──►  api/  ──►  (backend)
    │            │
    ├──────►  components/
    ├──────►  hooks/
    ├──────►  renderer/
    └──────►  lib/  ◄── tidak bergantung pada apa pun
```

Aturan yang ditegakkan:

| Lapisan | Boleh impor | Tidak boleh |
|---|---|---|
| `lib/` | — | apa pun (harus murni) |
| `types/` | — | apa pun |
| `api/` | `lib`, `types` | `features`, `components`, React |
| `renderer/` | `lib`, `types` | `api`, `features`, React |
| `components/` | `lib`, `types`, `hooks` | `features`, `api` |
| `features/` | semua | fitur lain |

**`renderer/` tidak boleh menyentuh React maupun `api/`.** Ia menerima data dan
canvas, lalu menggambar. Itu membuatnya bisa diuji tanpa merender komponen dan
tanpa memanggil backend.

**Satu fitur tidak boleh mengimpor fitur lain.** Kalau butuh sesuatu bersama,
naikkan ke `components/`, `hooks/`, atau `lib/`.

---

## 5. Penanganan state

| Jenis state | Alat | Contoh |
|---|---|---|
| Data dari backend | TanStack Query | daftar konten, pengaturan, kuota |
| State satu form | `useState` lokal | isi input topik |
| State lintas fitur | Context tipis | identitas merek, token |

**Jangan pakai Redux/Zustand** kecuali benar-benar terbukti perlu. Hampir semua
state di aplikasi ini adalah data server — dan itu tugas TanStack Query, bukan
state manager.

Alasan memilih TanStack Query: backend lambat (Apps Script bisa 2–200 detik),
jadi caching, retry, dan status loading bukan kemewahan melainkan kebutuhan.

---

## 6. Keamanan — batas yang jujur

Frontend statis **tidak bisa menyimpan rahasia**. Siapa pun bisa membuka
DevTools dan membaca token di `.env` hasil build.

Artinya:

- Token hanya **pembatas pemakaian**, bukan pengaman sungguhan
- Semua API key AI (Gemini, Cloudflare, Groq) tetap di **Script Properties**
  Apps Script — tidak pernah menyentuh repo ini
- Validasi sesungguhnya terjadi di backend, bukan di UI

Kalau nanti perlu keamanan lebih serius (misal aplikasi dibuka publik), yang
harus ditambah adalah login di sisi backend — bukan menyembunyikan token lebih
dalam di frontend.

---

## 7. Gambar dari Drive

Thumbnail Drive dipakai lewat URL:

```
https://drive.google.com/thumbnail?id=<fileId>&sz=w400
```

URL ini **butuh sesi login Google** di browser. Di halaman Apps Script itu
otomatis terpenuhi; di hosting sendiri tidak.

Tiga pilihan, dengan konsekuensinya:

| Cara | Kelebihan | Kekurangan |
|---|---|---|
| File Drive di-set "Anyone with link" | Tanpa kode tambahan | Gambar bisa diakses siapa saja yang punya link |
| Lewatkan lewat backend | Terkontrol token | Tiap gambar = satu eksekusi, lambat & makan kuota runtime |
| Data URL dari server | Sudah dipakai saat render | Payload besar, tidak cocok untuk daftar |

Pilihan saat ini: **"Anyone with link" untuk thumbnail**. Risikonya kecil —
ini gambar marketing yang memang akan dipublikasikan.

---

## 8. Batas yang tetap berlaku

Memindahkan UI tidak menghilangkan batasan backend:

| Batas | Angka | Dampak |
|---|---|---|
| Eksekusi per request | 6 menit | Alur 4 langkah wajib dipertahankan |
| Runtime harian | 90 menit | ~100 konten/hari |
| `UrlFetchApp` | 20.000/hari | Praktis tidak tersentuh |
| Drive | 15 GB | ~35.000 gambar @400 KB |
| Spreadsheet | 10 juta sel | Mulai lambat di ~5.000 baris CONTENT |
| Lock tulis | 10 detik | Bermasalah kalau 3+ orang generate bersamaan |

Titik nyeri pertama yang akan terasa: **kecepatan baca saat data menumpuk**,
dan **tabrakan saat beberapa orang memakai bersamaan**. Bukan kapasitas.

---

## 9. Jalan keluar kalau backend perlu diganti

Rancangan ini sengaja membuat penggantian backend menjadi pekerjaan backend
murni:

1. Semua panggilan lewat `src/api/client.ts` — satu file
2. Tipe data ada di `src/types/` — tidak terikat Apps Script
3. UI tidak pernah tahu bentuk spreadsheet

Kalau suatu hari spreadsheet terlalu lambat, yang perlu diganti hanya isi
`client.ts` dan backend-nya. Komponen, fitur, dan renderer tidak disentuh.

**Jangan merusak properti ini** dengan memanggil `fetch` langsung dari
komponen, atau membocorkan bentuk data spreadsheet ke UI.
