/**
 * fonts.ts — Pilihan font yang ditawarkan penyunting.
 *
 * Daftar ini sengaja pendek dan dikurasi, bukan seluruh katalog Google Fonts.
 * Alasannya dua: 1600 pilihan membuat orang berhenti memilih, dan katalog
 * penuh menuntut API key — satu kunci lagi yang harus diurus pemakai,
 * melanggar syarat "gratis tanpa repot" proyek ini.
 *
 * Semuanya tersedia di Google Fonts dan punya varian berat yang dibutuhkan
 * renderer (400/600/700 untuk judul, 300–600 untuk isi).
 */

/** Satu pilihan font beserta alasan singkat kenapa ia ada di daftar. */
export interface FontChoice {
  name: string;
  /** Nada yang dibawanya, ditampilkan sebagai keterangan di daftar. */
  note: string;
}

/**
 * Font judul: berkarakter, dipakai di ukuran besar.
 *
 * Skrip sambung (Great Vibes dan sejenisnya) hanya aman untuk judul pendek,
 * jadi ia ada di sini dan tidak pernah ditawarkan sebagai font isi.
 */
export const HEADING_FONTS: FontChoice[] = [
  { name: 'Playfair Display', note: 'Modern, kontras tinggi' },
  { name: 'Cormorant Garamond', note: 'Klasik, elegan' },
  { name: 'Libre Baskerville', note: 'Editorial, tenang' },
  { name: 'EB Garamond', note: 'Klasik, hangat' },
  { name: 'Marcellus', note: 'Anggun, sedikit klasik' },
  { name: 'Prata', note: 'Tegas, berkarakter' },
  { name: 'Italiana', note: 'Ramping, high-fashion' },
  { name: 'Tenor Sans', note: 'Bersih, modern lembut' },
  { name: 'Gilda Display', note: 'Halus, tradisional' },
  { name: 'Lora', note: 'Luwes, mudah dibaca' },
  { name: 'Great Vibes', note: 'Tulisan tangan — untuk judul pendek' },
  { name: 'Parisienne', note: 'Tulisan tangan, santai' },
];

/** Font isi: dipilih karena tetap terbaca di ukuran kecil. */
export const BODY_FONTS: FontChoice[] = [
  { name: 'Inter', note: 'Netral, sangat jernih' },
  { name: 'Montserrat', note: 'Geometris, ramah' },
  { name: 'Lato', note: 'Hangat, formal' },
  { name: 'Source Sans 3', note: 'Tenang, padat' },
  { name: 'Jost', note: 'Geometris, modern' },
  { name: 'Karla', note: 'Sedikit bersudut, khas' },
  { name: 'Raleway', note: 'Ramping, elegan' },
  { name: 'Nunito Sans', note: 'Bulat, lembut' },
  { name: 'Open Sans', note: 'Serba bisa, aman' },
  { name: 'Lora', note: 'Serif untuk isi, bernuansa cetak' },
];

/**
 * Pasangan siap pakai.
 *
 * Memilih dua font yang cocok itu pekerjaan desain tersendiri; daftar ini
 * memberi jalan pintas yang hasilnya sudah pasti serasi. Pemakai yang ingin
 * meramu sendiri tetap bisa lewat dua pemilih terpisah.
 */
export interface FontPair {
  label: string;
  heading: string;
  body: string;
}

export const FONT_PAIRS: FontPair[] = [
  { label: 'Modern', heading: 'Playfair Display', body: 'Inter' },
  { label: 'Klasik', heading: 'Cormorant Garamond', body: 'Montserrat' },
  { label: 'Formal', heading: 'Playfair Display', body: 'Lato' },
  { label: 'Lembut', heading: 'Cormorant Garamond', body: 'Lato' },
  { label: 'Editorial', heading: 'Libre Baskerville', body: 'Source Sans 3' },
  { label: 'Klasik modern', heading: 'EB Garamond', body: 'Jost' },
  { label: 'High fashion', heading: 'Italiana', body: 'Raleway' },
  { label: 'Hangat', heading: 'Marcellus', body: 'Karla' },
  { label: 'Tegas', heading: 'Prata', body: 'Nunito Sans' },
  { label: 'Tulisan tangan', heading: 'Great Vibes', body: 'Lato' },
];

/** Semua nama font yang dikenal, untuk memeriksa nilai tersimpan. */
export const KNOWN_FONTS: string[] = Array.from(
  new Set([...HEADING_FONTS, ...BODY_FONTS].map((f) => f.name)),
);

/**
 * Batas panjang nama font yang diketik sendiri.
 *
 * Nama font masuk ke URL Google Fonts dan ke deklarasi `ctx.font`. Nilai liar
 * dari spreadsheet tidak boleh lolos begitu saja ke keduanya.
 */
export const FONT_NAME_MAX = 48;

/**
 * Bersihkan nama font yang datang dari luar.
 *
 * Menerima nama di luar daftar kurasi — pemakai boleh mengetik font Google
 * mana pun — tapi hanya huruf, angka, spasi, dan tanda hubung. Tanda kutip
 * atau kurung akan merusak string `ctx.font` dan membuat seluruh teks gagal
 * tergambar tanpa pesan kesalahan.
 */
export function sanitizeFontName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;

  const clean = raw.trim().replace(/[^A-Za-z0-9 \-]/g, '');
  if (!clean || clean.length > FONT_NAME_MAX) return undefined;

  return clean;
}
