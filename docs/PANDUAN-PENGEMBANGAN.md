# Panduan Pengembangan

Konvensi yang wajib diikuti supaya kode tetap konsisten saat fitur bertambah.

Prinsip dasarnya satu: **tulis kode yang terbaca seperti kode di sekitarnya.**
Kalau ragu, buka file sejenis dan ikuti polanya.

---

## 1. Bahasa

| Bagian | Bahasa |
|---|---|
| Nama variabel, fungsi, tipe, file | **Inggris** |
| Komentar dan JSDoc | **Indonesia** |
| Teks yang dilihat pengguna | **Indonesia** |
| Pesan error untuk pengguna | **Indonesia** |
| Pesan `console` untuk developer | Indonesia |
| Commit message | **Indonesia** |

Ini melanjutkan konvensi backend yang sudah ada.

```ts
/** Ambil daftar konten yang siap dijadwalkan. */
export async function listReadyContent(): Promise<ContentSummary[]> {
  // Backend mengembalikan urutan terlama dulu, UI mau terbaru dulu.
  const rows = await call<ContentSummary[]>('listContent', { status: 'ready' });
  return rows.reverse();
}
```

**Komentar menjelaskan *kenapa*, bukan *apa*.** Kode sudah menjelaskan apa yang
terjadi; komentar menjelaskan alasan yang tidak terlihat dari kode.

```ts
// BURUK — mengulang apa yang sudah jelas
// Balik urutan array
return rows.reverse();

// BAIK — menjelaskan alasan
// Backend mengembalikan urutan terlama dulu, UI mau terbaru dulu.
return rows.reverse();
```

---

## 2. Penamaan file

| Jenis | Pola | Contoh |
|---|---|---|
| Komponen React | `PascalCase.tsx` | `ContentCard.tsx` |
| Hook | `useNamaHook.ts` | `useContentList.ts` |
| Utilitas | `camelCase.ts` | `formatDate.ts` |
| Tipe | `camelCase.ts` | `content.ts` |
| Tes | `*.test.ts` di samping sumbernya | `formatDate.test.ts` |

Satu komponen = satu file. Kalau file komponen melewati **250 baris**, itu
tanda ia mengerjakan lebih dari satu hal — pecah.

---

## 3. Struktur fitur

Setiap fitur berdiri sendiri di `src/features/<nama>/`:

```
features/generate/
├── GeneratePage.tsx      Komponen halaman, merangkai bagian lain
├── components/           Komponen khusus fitur ini
├── hooks/                Hook khusus fitur ini
└── index.ts              Ekspor publik fitur ini
```

**Aturan keras: satu fitur tidak boleh mengimpor fitur lain.**

Kalau dua fitur butuh hal yang sama, naikkan ke `components/`, `hooks/`, atau
`lib/`. Alasannya: begitu fitur saling mengimpor, menghapus atau mengubah satu
fitur jadi berisiko merusak yang lain.

Impor hanya lewat `index.ts` fitur, jangan menjangkau isi dalamnya:

```ts
// BENAR
import { GeneratePage } from '@/features/generate';

// SALAH — menjangkau isi dalam fitur lain
import { StepList } from '@/features/generate/components/StepList';
```

---

## 4. Memanggil backend

**Semua** panggilan lewat `src/api/`. Tidak boleh ada `fetch` di komponen.

```ts
// src/api/content.ts
import { call } from './client';
import type { ContentSummary } from '@/types/content';

/** Daftar konten untuk tab Library. */
export function listContent(filter: ContentFilter) {
  return call<ContentSummary[]>('listContent', { filter });
}
```

```ts
// src/features/library/hooks/useContentList.ts
export function useContentList(filter: ContentFilter) {
  return useQuery({
    queryKey: ['content', filter],
    queryFn: () => listContent(filter),
  });
}
```

Kenapa berlapis begini: kalau backend diganti, hanya `src/api/` yang berubah.
Lihat [ARSITEKTUR.md bagian 9](ARSITEKTUR.md).

### Menambah action baru

1. Tambah fungsi di `src/api/<domain>.ts`
2. Tambah tipenya di `src/types/`
3. Daftarkan action di router backend (`Main.gs`)
4. Catat di [`API.md`](API.md)

Keempatnya dalam satu commit. Jangan biarkan `API.md` tertinggal.

---

## 5. TypeScript

**Dilarang `any`.** Kalau bentuk data belum pasti, pakai `unknown` lalu
persempit.

```ts
// BURUK
function handle(data: any) { return data.caption; }

// BAIK
function handle(data: unknown): string {
  if (typeof data === 'object' && data && 'caption' in data) {
    return String(data.caption);
  }
  throw new Error('Data tidak punya caption.');
}
```

Tipe bersama ada di `src/types/`. **Jangan mendefinisikan ulang** bentuk yang
sama di beberapa tempat.

Gunakan union untuk nilai terbatas, bukan `string`:

```ts
// BAIK — salah ketik tertangkap saat compile
export type Format = 'story' | 'reels' | 'shorts' | 'carousel' | 'feed';
export type Status = 'draft' | 'ready' | 'approved' | 'posted';

// BURUK
export type Format = string;
```

Bentuk `spec` hasil AI berbeda per format. **Definisikan tipenya lebih dulu**
sebelum menulis komponen — ini sumber bug paling mungkin.

---

## 6. Komponen React

**Fungsi, bukan class.** Selalu.

```tsx
interface Props {
  content: ContentSummary;
  onSelect: (id: string) => void;
}

export function ContentCard({ content, onSelect }: Props) {
  return (
    <button onClick={() => onSelect(content.contentId)}>
      {content.topic}
    </button>
  );
}
```

Aturan:

- Props pakai `interface`, bukan inline type
- Jangan pakai `React.FC` — tidak memberi manfaat, membatasi generic
- Komponen yang memanggil data pakai hook, bukan `useEffect` + `fetch`
- Hindari `useEffect` untuk hal yang bisa dihitung saat render

```tsx
// BURUK — state turunan yang tidak perlu
const [total, setTotal] = useState(0);
useEffect(() => { setTotal(items.length); }, [items]);

// BAIK
const total = items.length;
```

---

## 7. Penanganan error

Backend selalu membalas `{ ok, data }` atau `{ ok, error }`. `call()` sudah
melempar `Error` kalau `ok: false`.

Di UI, **tampilkan pesan yang bisa ditindaklanjuti**:

```tsx
if (error) {
  return (
    <Alert>
      Gagal memuat daftar konten: {error.message}
      <button onClick={() => refetch()}>Coba lagi</button>
    </Alert>
  );
}
```

**Jangan menelan error diam-diam.** Kalau memang sengaja diabaikan, tulis
alasannya:

```ts
try {
  await saveDraft();
} catch {
  // Draft gagal disimpan tidak fatal — pengguna masih bisa lanjut generate.
}
```

### Kegagalan provider AI bukan error

Kuota habis dan fallback antar-provider adalah **kejadian normal**. Tampilkan
sebagai informasi, bukan sebagai kegagalan:

```
gemini gagal (kuota) → cloudflare ✓
```

Bukan dialog merah bertuliskan "Error".

---

## 8. Styling

Tailwind, dengan token warna dari identitas merek.

- **Jangan** menulis warna mentah (`#C9A961`) di komponen — pakai token
- Kelas panjang yang berulang → naikkan jadi komponen, bukan `@apply`
- Tema gelap adalah bawaan; pastikan kontras teks tetap terbaca

```tsx
// BURUK
<div className="bg-[#2E3A45] text-[#FAF7F2]">

// BAIK
<div className="bg-surface text-body">
```

---

## 9. Renderer Canvas

`src/renderer/` adalah modul murni. Aturan khusus:

- **Tidak boleh mengimpor React** atau apa pun dari `api/`
- Menerima data + `CanvasRenderingContext2D`, lalu menggambar
- Setiap fungsi gambar harus bisa dipanggil terpisah untuk pengujian

Kenapa: renderer diuji dengan canvas tiruan yang memeriksa setiap `fillText`
agar tidak keluar batas. Itu mustahil kalau ia terikat React.

Kalau mengubah layout, **jalankan tes renderer** — ada kasus nyata yang pernah
lolos: satu kata majemuk lebih panjang dari kolom.

---

## 10. Pengujian

Fokus pada yang mudah rusak:

| Wajib diuji | Contoh |
|---|---|
| Logika murni di `lib/` | format tanggal, validasi |
| Renderer terhadap teks ekstrem | kalimat sangat panjang, satu kata raksasa, teks kosong |
| Transformasi data di `api/` | pemetaan respons backend |

Tidak wajib: komponen presentasional tanpa logika.

```ts
describe('wrapText', () => {
  it('memecah kata yang lebih panjang dari kolom', () => {
    const lines = wrapText(ctx, 'pertanggungjawaban', 100);
    expect(lines.every(l => measure(l) <= 100)).toBe(true);
  });
});
```

---

## 11. Commit

Format: `<tipe>: <ringkasan dalam bahasa Indonesia>`

```
feat: tambah filter pilar di tab Library
fix: perbaiki teks meluber saat judul sangat panjang
docs: perjelas alasan Content-Type text/plain
refactor: pisahkan logika rotasi hashtag ke lib
test: tambah kasus teks kosong di renderer
chore: naikkan versi Vite
```

Aturan:

- Satu commit = satu perubahan logis
- Jangan campur perubahan format dengan perubahan logika
- Kalau menambah action backend, `API.md` ikut dalam commit yang sama

---

## 12. Sebelum push

```bash
npm run typecheck
npm run lint
npm run test
```

Ketiganya harus lolos. Dan periksa sekali lagi bahwa `.env` **tidak** ikut
ter-commit:

```bash
git status --short
```

---

## 13. Yang tidak boleh dilakukan

Daftar ini pendek karena isinya benar-benar penting:

1. **Jangan `fetch` langsung dari komponen** — selalu lewat `src/api/`
2. **Jangan commit `.env`** atau kredensial apa pun
3. **Jangan gabungkan alur 4 langkah** produksi konten — batas 6 menit tetap ada
4. **Jangan impor antar-fitur** — naikkan ke lapisan bersama
5. **Jangan pakai `any`**
6. **Jangan bocorkan bentuk spreadsheet ke UI** — itu merusak jalan keluar
   penggantian backend
7. **Jangan pakai `Content-Type: application/json`** saat memanggil backend —
   akan diblokir CORS tanpa pesan yang jelas
