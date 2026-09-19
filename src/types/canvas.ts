/**
 * canvas.ts — Model dokumen untuk editor kanvas bebas.
 *
 * INI BUKAN PENGGANTI `design.ts`.
 *
 * `DesignOverrides` menyetel *template*: renderer yang menentukan posisi, user
 * hanya memilih atas/tengah/bawah. Berkas ini kebalikannya — user menentukan
 * posisi persis tiap elemen, dan tidak ada template yang ikut campur.
 *
 * Keduanya sengaja hidup berdampingan. Alur AI yang sudah berjalan tetap
 * memakai template karena kekuatannya justru di situ: hasilnya rapi tanpa
 * perlu menata apa pun. Editor ini untuk pekerjaan yang template tidak bisa.
 */

/** Ukuran kanvas per format, sama dengan yang dipakai renderer template. */
export const CANVAS_PRESETS = {
  story: { w: 1080, h: 1920, label: 'Story / Reels (9:16)' },
  carousel: { w: 1080, h: 1350, label: 'Carousel / Feed (4:5)' },
  square: { w: 1080, h: 1080, label: 'Persegi (1:1)' },
} as const;

export type PresetId = keyof typeof CANVAS_PRESETS;

/**
 * Sifat yang dimiliki SETIAP elemen, apa pun jenisnya.
 *
 * `x`/`y` adalah titik kiri-atas dalam piksel kanvas (bukan piksel layar —
 * kanvas 1080px bisa tampil 400px di layar, dan konversinya urusan editor).
 * `rotation` dalam derajat, berputar di titik tengah elemen.
 */
export interface BaseElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  /** Elemen terkunci tetap terlihat tapi tidak bisa diseret atau dipilih. */
  locked: boolean;
  visible: boolean;
}

/**
 * Kotak teks.
 *
 * Ukurannya absolut (`fontSize` piksel), berbeda dari `fontScale` di
 * `design.ts` yang berupa pengali. Di editor bebas, user melihat langsung
 * hasilnya sambil menyeret, jadi tidak ada gunanya menyembunyikan angka
 * sebenarnya di balik pengali.
 */
export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
}

/** Gambar: foto unggahan, logo, atau hasil AI. Sumbernya selalu data URL. */
export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  /** Nama untuk ditampilkan di panel layer. */
  name: string;
}

/** Bentuk dasar. Digambar kode, tanpa jaringan dan tanpa penyimpanan. */
export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Sudut membulat, hanya untuk 'rect'. */
  cornerRadius: number;
}

export type CanvasElement = TextElement | ImageElement | ShapeElement;

/** Satu dokumen desain. */
export interface CanvasDoc {
  preset: PresetId;
  background: string;
  /**
   * Urutan dalam array ADALAH urutan tumpukan: indeks 0 paling belakang.
   *
   * Sengaja tidak memakai field `zIndex`. Dua sumber kebenaran untuk urutan
   * yang sama pasti berselisih suatu saat — dan yang menang biasanya bukan
   * yang dilihat user.
   */
  elements: CanvasElement[];
}

/** @return {!CanvasDoc} Dokumen kosong pada preset tertentu. */
export function emptyDoc(preset: PresetId = 'carousel'): CanvasDoc {
  return { preset, background: '#FAF7F2', elements: [] };
}

/**
 * ID unik untuk elemen baru.
 *
 * `crypto.randomUUID` tidak dipakai: ia hanya tersedia di konteks aman, dan
 * pratinjau lokal lewat alamat IP bukan salah satunya — elemen akan gagal
 * dibuat tanpa pesan yang jelas.
 */
let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

/** Nilai bawaan yang dipakai setiap elemen baru. */
const BASE: Omit<BaseElement, 'id' | 'x' | 'y' | 'width' | 'height'> = {
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
};

/** @return {!TextElement} Kotak teks baru di posisi tertentu. */
export function makeText(x: number, y: number, over: Partial<TextElement> = {}): TextElement {
  return {
    ...BASE,
    id: newId('t'),
    type: 'text',
    x,
    y,
    width: 600,
    height: 120,
    text: 'Ketik di sini',
    fontFamily: 'Inter',
    fontSize: 64,
    fontWeight: 400,
    fill: '#1C1C1C',
    align: 'left',
    lineHeight: 1.3,
    letterSpacing: 0,
    ...over,
  };
}

/** @return {!ShapeElement} Bentuk baru di posisi tertentu. */
export function makeShape(
  shape: ShapeElement['shape'],
  x: number,
  y: number,
  over: Partial<ShapeElement> = {},
): ShapeElement {
  return {
    ...BASE,
    id: newId('s'),
    type: 'shape',
    shape,
    x,
    y,
    width: 300,
    height: shape === 'line' ? 4 : 300,
    fill: shape === 'line' ? 'transparent' : '#C9A961',
    stroke: shape === 'line' ? '#C9A961' : 'transparent',
    strokeWidth: shape === 'line' ? 4 : 0,
    cornerRadius: 0,
    ...over,
  };
}

/**
 * @return {!ImageElement} Gambar baru, diskalakan agar muat di kanvas.
 *
 * Gambar 4000px yang ditaruh apa adanya akan menutupi seluruh kanvas dan
 * pegangan ubah-ukurannya berada di luar layar — user tidak punya cara
 * memperbaikinya selain undo.
 */
export function makeImage(
  src: string,
  naturalW: number,
  naturalH: number,
  canvasW: number,
  canvasH: number,
  over: Partial<ImageElement> = {},
): ImageElement {
  const max = Math.min(canvasW * 0.6, canvasH * 0.6);
  const scale = Math.min(1, max / Math.max(naturalW, naturalH));
  const w = Math.round(naturalW * scale);
  const h = Math.round(naturalH * scale);

  return {
    ...BASE,
    id: newId('i'),
    type: 'image',
    x: Math.round((canvasW - w) / 2),
    y: Math.round((canvasH - h) / 2),
    width: w,
    height: h,
    src,
    name: 'Gambar',
    ...over,
  };
}

/** @return {string} Label elemen untuk panel layer. */
export function elementLabel(el: CanvasElement): string {
  if (el.type === 'text') {
    const t = el.text.trim().replace(/\s+/g, ' ');
    return t.length > 24 ? `${t.slice(0, 24)}…` : t || 'Teks kosong';
  }
  if (el.type === 'image') return el.name;
  return { rect: 'Kotak', ellipse: 'Lingkaran', line: 'Garis' }[el.shape];
}
