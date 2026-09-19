# Menyiapkan Backend

Langkah menyiapkan Apps Script supaya bisa dipanggil dari UI ini.

> **Deploy bersih ke akun Google baru?** Pakai
> [`../backend/README.md`](../backend/README.md) — panduannya lengkap dari nol
> termasuk membuat Spreadsheet dan folder Drive. Dokumen ini hanya merinci
> bagian yang paling mudah salah.

---

## 1. Pasang kode

- [ ] Buka editor Apps Script pada project yang baru dibuat
- [ ] Hapus seluruh isi `Code.gs` bawaan
- [ ] Paste seluruh isi `backend/Kode.gs`
- [ ] **Ctrl+S**

Satu berkas itu sudah berisi seluruh backend: `doPost`, seluruh fungsi `api*`,
sampai rantai fallback AI.

Backend ini murni API — tidak ada `doGet` dan tidak menyajikan HTML. Kalau UI
lama berbasis `google.script.run` masih ingin dipakai berdampingan, ia harus
tinggal di project Apps Script yang terpisah.

---

## 2. Buat token

Jalankan di terminal untuk menghasilkan token acak:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

- [ ] Salin hasilnya
- [ ] Di Apps Script: ⚙️ **Project Settings** → **Script Properties** →
      **Edit script properties**
- [ ] Tambah property `API_TOKEN` dengan nilai token tadi
- [ ] **Save script properties**

---

## 3. Deploy dengan akses "Anyone"

Pada project yang benar-benar baru:

- [ ] **Deploy → New deployment → ⚙ → Web app**
- [ ] **Execute as: Me**, **Who has access: Anyone**
- [ ] **Deploy**, lalu salin **Web app URL**

Memperbarui deployment yang sudah ada — **jangan** pilih *New deployment*,
karena itu membuat URL baru:

- [ ] **Deploy → Manage deployments → ikon pensil**
- [ ] Version: **New version** → **Deploy**

> **Kenapa harus "Anyone"?** Pemanggilnya bukan lagi halaman Google, jadi
> Apps Script tidak bisa mengenali sesi login. Akses "Only myself" akan
> menolak semua permintaan dari luar.
>
> Konsekuensinya URL itu jadi kunci — siapa pun yang memilikinya bisa
> memanggil. Karena itu `API_TOKEN` wajib diisi; `doPost` menolak permintaan
> tanpa token yang benar sebelum mengerjakan apa pun.

---

## 4. Uji tanpa UI

Buktikan backend hidup sebelum menyentuh frontend:

```bash
curl -L -X POST "<WEB_APP_URL>" \
  -H "Content-Type: text/plain" \
  -d '{"action":"ping","token":"<API_TOKEN>"}'
```

Harusnya membalas:

```json
{"ok":true,"data":{"service":"kosa-smd-generator","time":"..."}}
```

Uji juga bahwa token salah ditolak:

```bash
curl -L -X POST "<WEB_APP_URL>" \
  -H "Content-Type: text/plain" \
  -d '{"action":"ping","token":"salah"}'
```

Harusnya: `{"ok":false,"error":"Token tidak sah."}`

> `-L` wajib. Apps Script membalas `302` lebih dulu.

---

## 5. Hubungkan UI

- [ ] Di folder repo ini: `cp .env.example .env`
- [ ] Isi `VITE_APPS_SCRIPT_URL` dengan Web app URL
- [ ] Isi `VITE_API_TOKEN` dengan token yang sama
- [ ] `npm run dev`

---

## Kalau macet

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `Balasan server bukan JSON` | Deployment belum diperbarui, atau URL salah | Deploy **New version**, periksa URL |
| `Token tidak sah` | `API_TOKEN` beda antara `.env` dan Script Properties | Samakan persis |
| `Script Property "API_TOKEN" belum diisi` | Langkah 2 terlewat | Isi Script Property |
| Error CORS di console browser | UI memakai `application/json` | Harus `text/plain` — lihat `src/api/client.ts` |
| Balasan berupa halaman login Google | Akses masih "Only myself" | Ubah jadi **Anyone** |
| `Terlalu banyak permintaan` | Batas 120/jam tercapai | Tunggu, atau ubah `API_RATE_LIMIT_PER_HOUR` |

---

## Catatan keamanan

Token di frontend **bukan rahasia sungguhan** — build statis selalu bisa dibaca
pengunjung lewat DevTools. Fungsinya membatasi pemakaian tak sengaja, bukan
menahan penyerang.

Yang benar-benar terlindungi: semua API key AI (Gemini, Cloudflare, Groq,
OpenRouter) tetap di Script Properties dan **tidak pernah** dikirim ke browser.

Kalau nanti aplikasi dibuka untuk publik, yang perlu ditambah adalah login di
sisi backend — bukan menyembunyikan token lebih dalam di frontend.
