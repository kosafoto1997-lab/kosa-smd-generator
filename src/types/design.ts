/**
 * design.ts — Penyetelan visual per konten.
 *
 * Renderer punya angka bawaan hasil penyetelan visual yang cocok untuk
 * sebagian besar konten. Tipe ini menampung penyimpangan dari angka itu,
 * bukan menggantikannya: **setiap field opsional, dan field yang tidak diisi
 * berarti "pakai bawaan"**.
 *
 * Konsekuensinya penting — konten yang dibuat sebelum fitur ini ada tetap
 * tergambar persis seperti semula, karena override-nya kosong.
 */

import { sanitizeFontName } from './fonts';
import type { Brand } from './brand';

/** Peletakan blok teks secara vertikal. */
export type TextPosition = 'atas' | 'tengah' | 'bawah';

/** Perataan teks secara horizontal. */
export type TextAlign = 'left' | 'center';

export interface DesignOverrides {
  /** Posisi blok teks. Bawaan: 'bawah'. */
  textPosition?: TextPosition;
  /** Perataan teks. Bawaan: 'left'. */
  textAlign?: TextAlign;
  /**
   * Pengali ukuran font, 0.7–1.4. Bawaan 1.
   *
   * Pengali, bukan ukuran mutlak, karena renderer sudah mengecilkan font
   * otomatis saat teks kepanjangan. Angka mutlak akan membatalkan mekanisme
   * itu dan membuat teks terpotong.
   */
  fontScale?: number;
  /**
   * Ketebalan lapisan gelap di atas foto, 0–0.85. Bawaan 0.12.
   *
   * Foto terang butuh lapisan lebih tebal agar teks putih terbaca; foto gelap
   * justru tertelan kalau digelapkan lagi.
   */
  overlay?: number;
  /** Sembunyikan kapsul nama pilar di sampul. */
  hideBadge?: boolean;
  /** Sembunyikan handle Instagram. */
  hideHandle?: boolean;
  /**
   * Font judul, menimpa yang tercatat di sheet BRAND.
   *
   * Ada di sini, bukan di BRAND, karena ini penyimpangan untuk satu konten:
   * satu unggahan boleh memakai skrip sambung tanpa mengubah identitas merek
   * untuk seluruh konten lain.
   */
  fontHeading?: string;
  /** Font isi, menimpa yang tercatat di sheet BRAND. */
  fontBody?: string;
}

/** Batas nilai yang diterima, dipakai slider maupun pembersih data. */
export const DESIGN_LIMITS = {
  fontScale: { min: 0.7, max: 1.4, step: 0.05, default: 1 },
  overlay: { min: 0, max: 0.85, step: 0.05, default: 0.12 },
} as const;

/** Jepit angka ke rentang yang diizinkan. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Bersihkan override yang datang dari luar (spreadsheet, URL, versi lama).
 *
 * Data tersimpan bisa saja rusak atau berasal dari versi yang bentuknya
 * berbeda. Renderer tidak boleh menerima angka liar — fontScale 50 akan
 * menggambar teks jauh di luar kanvas tanpa pesan kesalahan apa pun.
 */
export function sanitizeDesign(raw: unknown): DesignOverrides {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: DesignOverrides = {};

  if (o.textPosition === 'atas' || o.textPosition === 'tengah' || o.textPosition === 'bawah') {
    out.textPosition = o.textPosition;
  }
  if (o.textAlign === 'left' || o.textAlign === 'center') {
    out.textAlign = o.textAlign;
  }
  if (typeof o.fontScale === 'number' && Number.isFinite(o.fontScale)) {
    const { min, max } = DESIGN_LIMITS.fontScale;
    out.fontScale = clamp(o.fontScale, min, max);
  }
  if (typeof o.overlay === 'number' && Number.isFinite(o.overlay)) {
    const { min, max } = DESIGN_LIMITS.overlay;
    out.overlay = clamp(o.overlay, min, max);
  }
  if (o.hideBadge === true) out.hideBadge = true;
  if (o.hideHandle === true) out.hideHandle = true;

  const heading = sanitizeFontName(o.fontHeading);
  if (heading) out.fontHeading = heading;

  const body = sanitizeFontName(o.fontBody);
  if (body) out.fontBody = body;

  return out;
}

/**
 * Gabungkan override font ke dalam identitas merek.
 *
 * Seluruh layout membaca font lewat `brandValue(brand, 'fontHeading'|'fontBody')`,
 * jadi menimpanya di sini membuat penggantian font bekerja tanpa satu baris pun
 * berubah di kode layout.
 */
export function brandWithDesign(brand: Brand, design?: DesignOverrides): Brand {
  if (!design?.fontHeading && !design?.fontBody) return brand;

  return {
    ...brand,
    ...(design.fontHeading ? { fontHeading: design.fontHeading } : {}),
    ...(design.fontBody ? { fontBody: design.fontBody } : {}),
  };
}

/** True kalau tidak ada satu pun penyetelan — dipakai untuk menandai "asli". */
export function isDefaultDesign(d: DesignOverrides): boolean {
  return Object.keys(d).length === 0;
}
