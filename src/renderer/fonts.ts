/**
 * fonts.ts — Pemuatan font dari Google Fonts.
 *
 * Kenapa perlu menunggu: tanpa penantian eksplisit, teks pertama sering
 * tergambar dengan font bawaan sistem karena font merek belum selesai diunduh.
 * Canvas tidak menggambar ulang sendiri saat font akhirnya siap — `fillText`
 * menulis piksel sekali jalan, tidak ada ikatan hidup ke font seperti di DOM.
 */
import { brandValue, type Brand } from '@/types/brand';

/**
 * Memo per kombinasi font, bukan satu memo global.
 *
 * Dulu memo ini satu untuk seluruh sesi, jadi penyunting yang mengganti font
 * menerima promise lama yang sudah selesai: font barunya tidak pernah diminta
 * dan canvas diam-diam menggambar dengan fallback. Kunci per pasangan nama
 * membuat tiap kombinasi dimuat sekali, dan kombinasi yang pernah dipakai
 * langsung siap saat dipilih lagi.
 */
const loaded = new Map<string, Promise<unknown>>();

/**
 * Contoh teks yang ikut dikirim saat meminta font.
 *
 * Google Fonts memecah satu keluarga jadi beberapa blok `unicode-range`
 * (latin, latin-ext, dan seterusnya). Permintaan tanpa teks hanya cocok
 * dengan blok yang memuat spasi, sehingga huruf beraksen dan tanda baca tipografis
 * bisa tergambar sebagai kotak kosong. Menyertakan contoh ini memaksa blok
 * yang benar-benar dipakai naskah Indonesia ikut terunduh.
 */
const PROBE_TEXT = 'AaBbCc0123 áéíóú “”—…';

/** Ubah nama font jadi bentuk yang dipakai URL Google Fonts. */
function familyParam(name: string): string {
  return name.replace(/\s+/g, '+');
}

/** Pasang <link> stylesheet sekali per kombinasi font. */
function injectLink(key: string, heading: string, body: string): void {
  const selector = `link[data-renderer-fonts="${CSS.escape(key)}"]`;
  if (document.querySelector(selector)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2' +
    `?family=${familyParam(heading)}:wght@400;600;700` +
    `&family=${familyParam(body)}:wght@300;400;500;600` +
    '&display=swap';
  link.setAttribute('data-renderer-fonts', key);
  document.head.appendChild(link);
}

/**
 * Batas tunggu font sebelum render dilanjutkan memakai fallback.
 *
 * Tanpa batas ini render bisa menggantung selamanya, bukan gagal. `.catch()`
 * tidak menolong: yang bermasalah bukan promise yang menolak, melainkan promise
 * yang tidak pernah selesai. Dua penyebab nyatanya:
 *
 * 1. `fonts.googleapis.com` diblokir proxy atau DNS yang membuang paket tanpa
 *    membalas — permintaan stylesheet menggantung, bukan gagal.
 * 2. `document.fonts.ready` baru terpenuhi kalau SELURUH font di halaman
 *    selesai dimuat. Satu font pratinjau yang masih berjalan sudah cukup
 *    menahannya.
 *
 * Tiga detik cukup longgar untuk jaringan lambat, dan menunggu lebih lama pun
 * tidak ada gunanya: yang hilang hanya font merek, bukan kontennya.
 */
const FONT_WAIT_MS = 3000;

/** Selesai setelah `ms`, dipakai sebagai lomba melawan penantian font. */
function timeout(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

/**
 * Muat font merek dan tunggu sampai benar-benar siap dipakai canvas.
 *
 * Tidak pernah menolak DAN tidak pernah menggantung: font yang gagal atau
 * lambat dimuat bukan alasan membatalkan render — `fontStack()` sudah
 * menyediakan fallback yang proporsinya mirip.
 */
export function ensureFonts(brand: Brand): Promise<unknown> {
  const heading = brandValue(brand, 'fontHeading');
  const body = brandValue(brand, 'fontBody');
  const key = `${heading}|${body}`;

  const hit = loaded.get(key);
  if (hit) return hit;

  injectLink(key, heading, body);

  // Minta browser benar-benar memuat tiap varian yang akan dipakai renderer.
  // document.fonts.ready saja tidak cukup — ia terpenuhi bahkan ketika tidak
  // ada font yang dimuat sama sekali, jadi ia tidak tahu varian mana yang akan
  // diminta canvas nanti.
  //
  // Ukuran wajib ikut dalam string: spesifikasi CSS Font Loading menolak nama
  // keluarga telanjang dengan SyntaxError.
  const probes = [
    `700 92px "${heading}"`,
    `400 92px "${heading}"`,
    `600 44px "${body}"`,
    `300 44px "${body}"`,
  ];

  const ready = Promise.race([
    Promise.all(
      probes.map((p) => document.fonts.load(p, PROBE_TEXT).catch(() => null)),
    )
      .then(() => document.fonts.ready)
      .catch(() => null),
    timeout(FONT_WAIT_MS),
  ]);

  loaded.set(key, ready);
  return ready;
}

/**
 * Nama keluarga terpisah untuk font pratinjau daftar.
 *
 * WAJIB berbeda dari nama aslinya. Font pratinjau hanya berisi glyph untuk
 * nama font itu sendiri; kalau ia memakai nama keluarga yang sama, browser
 * boleh memilihnya saat canvas menggambar naskah sungguhan — dan setiap huruf
 * di luar nama font itu berubah jadi kotak kosong.
 */
export function previewFamily(name: string): string {
  return `${name} KosaPreview`;
}

/**
 * Muat satu font untuk keperluan pratinjau di daftar pilihan.
 *
 * Memakai parameter `text=` Google Fonts sehingga yang diunduh hanya glyph
 * untuk nama font itu sendiri — pengukuran Google menyebut penghematan sampai
 * 90%. Tanpa itu, menampilkan dua puluhan nama font dengan huruf aslinya
 * berarti mengunduh dua puluhan font utuh hanya untuk sebuah daftar.
 *
 * Diambil lewat FontFace API, bukan <link>, supaya bisa didaftarkan dengan
 * nama keluarga tersendiri — lihat `previewFamily()`.
 */
export function ensurePreviewFont(name: string): Promise<unknown> {
  const key = `preview:${name}`;

  const hit = loaded.get(key);
  if (hit) return hit;

  const css =
    'https://fonts.googleapis.com/css2' +
    `?family=${familyParam(name)}` +
    `&text=${encodeURIComponent(name)}`;

  const ready = fetch(css)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error('gagal'))))
    .then((sheet) => {
      // Ambil URL woff2 dari @font-face yang dikirim Google.
      const m = sheet.match(/src:\s*url\(([^)]+)\)/);
      if (!m || !m[1]) throw new Error('src tidak ditemukan');

      const face = new FontFace(previewFamily(name), `url(${m[1]})`);
      return face.load();
    })
    .then((face) => {
      document.fonts.add(face);
      return face;
    })
    // Pratinjau yang gagal dimuat hanya membuat baris tampil dengan huruf
    // antarmuka biasa — tidak perlu mengganggu siapa pun.
    .catch(() => null);

  loaded.set(key, ready);
  return ready;
}

/** Buang memo, dipakai kalau identitas merek berubah saat aplikasi berjalan. */
export function resetFonts(): void {
  loaded.clear();
  document.querySelectorAll('link[data-renderer-fonts]').forEach((el) => el.remove());
}
