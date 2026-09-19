/**
 * text.ts — Pemecahan baris dan penyesuaian ukuran teks.
 *
 * Ini modul paling rawan di renderer: teks yang meluber keluar kanvas adalah
 * bug yang pernah benar-benar terjadi (kata majemuk panjang lebih lebar dari
 * kolom). Karena itu setiap fungsi di sini diuji terhadap teks ekstrem.
 *
 * Hanya bergantung pada antarmuka pengukur teks, bukan pada canvas sungguhan,
 * sehingga bisa diuji dengan pengukur tiruan.
 */

/** Bagian canvas yang benar-benar dipakai modul ini. */
export interface TextMeasurer {
  font: string;
  measureText(text: string): { width: number };
}

export interface FitOptions {
  family: string;
  /** Ukuran awal, diturunkan bertahap sampai muat. */
  start: number;
  /** Batas bawah; di bawah ini teks dipotong dengan elipsis. */
  min: number;
  maxWidth: number;
  maxLines?: number;
  weight?: number;
  isHeading?: boolean;
  /** Pengali tinggi baris terhadap ukuran font. */
  lineHeight?: number;
}

export interface FitResult {
  size: number;
  lines: string[];
  lineHeight: number;
}

/**
 * Susun deklarasi font CSS lengkap dengan fallback.
 *
 * Fallback penting: kalau Google Fonts gagal dimuat, teks tetap tergambar
 * dengan proporsi yang mirip alih-alih font bawaan sistem yang acak.
 */
export function fontStack(
  name: string,
  weight: number,
  size: number,
  isHeading: boolean,
): string {
  const fallback = isHeading
    ? '"Times New Roman", Georgia, serif'
    : '"Helvetica Neue", Arial, sans-serif';
  return `${weight} ${size}px "${name}", ${fallback}`;
}

/**
 * Pecah satu kata yang lebih lebar dari kolom menjadi potongan yang muat.
 *
 * Tanpa ini, kata majemuk panjang seperti "pertanggungjawaban" atau URL akan
 * meluber keluar kanvas — karena algoritma pembungkus biasa tidak pernah
 * memecah di tengah kata.
 */
export function breakLongWord(
  ctx: TextMeasurer,
  word: string,
  maxWidth: number,
): string[] {
  const chunks: string[] = [];
  let cur = '';

  for (const ch of word) {
    const next = cur + ch;
    if (cur && ctx.measureText(next).width > maxWidth) {
      chunks.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);

  return chunks;
}

/** Pecah teks jadi baris-baris yang muat di lebar tertentu. */
export function wrapText(
  ctx: TextMeasurer,
  text: string,
  maxWidth: number,
): string[] {
  const raw = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (raw.length === 0) return [];

  // Pecah dulu kata yang sendirian saja sudah terlalu lebar.
  const words: string[] = [];
  for (const w of raw) {
    if (ctx.measureText(w).width > maxWidth) {
      words.push(...breakLongWord(ctx, w, maxWidth));
    } else {
      words.push(w);
    }
  }

  const lines: string[] = [];
  let line = words[0] ?? '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i] ?? '';
    const test = `${line} ${word}`;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  return lines;
}

/**
 * Turunkan ukuran font bertahap sampai teks muat dalam batas baris.
 * Elipsis hanya dipakai kalau sudah menyentuh ukuran minimum.
 */
export function fitText(
  ctx: TextMeasurer,
  text: string,
  opts: FitOptions,
): FitResult {
  const weight = opts.weight ?? 400;
  const isHeading = opts.isHeading ?? false;
  const maxLines = opts.maxLines ?? 3;
  const ratio = opts.lineHeight ?? 1.18;

  let size = opts.start;

  while (size > opts.min) {
    ctx.font = fontStack(opts.family, weight, size, isHeading);
    const lines = wrapText(ctx, text, opts.maxWidth);

    // Jumlah baris DAN lebar tiap baris harus sama-sama muat.
    const fits =
      lines.length <= maxLines &&
      lines.every((l) => ctx.measureText(l).width <= opts.maxWidth);

    if (fits) {
      return { size, lines, lineHeight: Math.round(size * ratio) };
    }
    size -= 2;
  }

  // Sudah di ukuran minimum: potong dan beri elipsis.
  ctx.font = fontStack(opts.family, weight, opts.min, isHeading);
  const lines = wrapText(ctx, text, opts.maxWidth).slice(0, maxLines);

  if (lines.length === maxLines) {
    let last = lines[maxLines - 1] ?? '';
    while (last.length > 4 && ctx.measureText(`${last}…`).width > opts.maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last.replace(/[\s,.;:]+$/, '')}…`;
  }

  return {
    size: opts.min,
    lines,
    lineHeight: Math.round(opts.min * ratio),
  };
}
