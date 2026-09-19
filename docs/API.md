# API Backend

Daftar action yang disediakan backend Apps Script.

**Dokumen ini harus diperbarui dalam commit yang sama** saat menambah atau
mengubah action.

---

## Bentuk pemanggilan

Semua action lewat satu endpoint dengan `POST`:

```ts
fetch(VITE_APPS_SCRIPT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action, payload, token }),
  redirect: 'follow',
});
```

> `text/plain` dan `redirect: 'follow'` keduanya wajib. Alasannya di
> [ARSITEKTUR.md bagian 2.1](ARSITEKTUR.md).

## Bentuk balasan

Selalu salah satu dari dua ini — tidak pernah exception mentah:

```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": "pesan dalam bahasa Indonesia" }
```

`call()` di `src/api/client.ts` sudah membuka bungkus ini: mengembalikan `data`
kalau berhasil, melempar `Error` kalau gagal.

---

## Pengaturan & inisialisasi

| Action | Payload | Balasan |
|---|---|---|
| `bootstrap` | — | Data awal UI: brand, pilar, config, status provider, statistik |
| `initDatabase` | — | Buat semua tab + data awal. Aman diulang |
| `saveSettings` | `{ brand?, config? }` | `{ saved: true }` |
| `getQuotaStatus` | — | Status kuota semua provider hari ini |
| `resetBreakers` | — | Bebaskan semua circuit breaker |
| `testProviders` | `{ kind: 'text' \| 'image' \| 'all' }` | Hasil ping tiap provider |

> `testProviders` dengan `kind: 'image'` **memakai kuota AI sungguhan** —
> satu panggilan per provider.

---

## Produksi konten

Empat langkah **terpisah**. Jangan digabung — batas eksekusi 6 menit.

### 1. `generateText`

```ts
payload: {
  format: Format,          // 'story' | 'reels' | 'shorts' | 'carousel' | 'feed'
  pillar: string,          // atau 'auto'
  topic: string,           // boleh kosong
  opts: { count?: number } // jumlah slide/frame
}
```

Balasan berisi `content_id`, `spec` (bentuknya berbeda per format), daftar
`attempts` provider, dan `sanitized` kalau ada kata terlarang yang dibersihkan.

### 2. `fetchImage`

```ts
payload: { prompt: string, contentId: string, index: number, format: Format }
```

Balasan: `{ provider, attempts, dataUrl, rawFileId }`.

`dataUrl` bernilai `null` kalau semua provider gambar gagal — itu **bukan
error**, artinya renderer harus memakai latar prosedural.

Diulang sebanyak jumlah gambar yang dibutuhkan.

### 3. `uploadRendered`

```ts
payload: { contentId: string, format: Format, index: number, base64: string }
```

Hasil render dari canvas dikirim sebagai base64 JPEG.

### 4. `saveContent`

```ts
payload: { /* ringkasan konten + daftar slide */ }
```

Menulis ke sheet `CONTENT` dan `SLIDES`.

---

## Ide

| Action | Payload | Balasan |
|---|---|---|
| `generateIdeas` | `{ pillar, count }` | Ide baru ditulis ke sheet `IDEAS` |
| `listIdeas` | `{ pillar? }` | Maksimal 50 ide yang belum dipakai |

---

## Library & kalender

| Action | Payload | Balasan |
|---|---|---|
| `listContent` | `{ filter: { status?, format?, pillar?, limit? } }` | Maksimal 100, terbaru dulu |
| `getContent` | `{ contentId }` | Detail + semua slide |
| `updateContentStatus` | `{ contentId, status }` | `draft \| ready \| approved \| posted` |
| `updateCaption` | `{ contentId, caption, hashtags? }` | Caption dibersihkan otomatis dari kata terlarang |
| `schedulePublish` | `{ contentId, platform, datetime }` | Tulis ke `PUBLISH_LOG` |
| `getCalendar` | `{ month }` | Format `yyyy-MM` |
| `getRawImage` | `{ contentId, index }` | Data URL gambar mentah dari `99_Raw_AI` |

> `getRawImage` dipakai untuk **render ulang tanpa AI** — tidak menyentuh kuota
> sama sekali.

---

## Bank hashtag

| Action | Payload |
|---|---|
| `listHashtags` | — |
| `addHashtag` | `{ tag, pillar, tier }` |
| `deleteHashtag` | `{ tag }` |

Rotasi berjalan otomatis berdasarkan yang paling lama tidak dipakai, sehingga
dua post berturut-turut tidak pernah punya set hashtag identik.

---

## Catatan penting

**Provider gagal bukan error.** Rantai fallback AI menangani kuota habis
sebagai kejadian normal. Balasan `generateText` dan `fetchImage` berisi
`attempts[]` yang mencatat provider mana yang dicoba dan kenapa gagal.
Tampilkan sebagai informasi, bukan sebagai kegagalan.

**Lapis terakhir selalu berhasil.** Teks jatuh ke penyusun template lokal,
gambar jatuh ke latar prosedural. Keduanya tidak menyentuh jaringan, jadi
produksi konten tidak pernah benar-benar berhenti.

**Waktu respons sangat bervariasi** — dari 300 ms (Groq) sampai 200 detik
(OpenRouter saat antre). Selalu tampilkan status loading yang jelas.
