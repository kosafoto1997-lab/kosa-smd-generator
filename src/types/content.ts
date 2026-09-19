/**
 * Tipe inti konten.
 *
 * Bentuk `spec` berbeda per format dan merupakan sumber bug paling mungkin
 * saat menambah fitur. Karena itu dibuat discriminated union — TypeScript akan
 * memaksa pengecekan `format` sebelum mengakses field yang khusus.
 */

/** Format konten yang didukung. */
export type Format = 'story' | 'reels' | 'shorts' | 'carousel' | 'feed';

/** Status perjalanan satu konten. */
export type Status = 'draft' | 'ready' | 'approved' | 'posted';

/** Pilar konten. Bobotnya diatur di sheet CONFIG. */
export type Pillar = 'edukasi' | 'inspirasi' | 'relatable' | 'softproduct';

/** Ukuran kanvas per format, dalam piksel. */
export const CANVAS_SIZE: Record<Format, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  reels: { w: 1080, h: 1920 },
  shorts: { w: 1080, h: 1920 },
  carousel: { w: 1080, h: 1350 },
  feed: { w: 1080, h: 1350 },
};

/* ------------------------------------------------------------------ spec */

/** Teks yang ditempel di atas gambar. */
export interface OnscreenText {
  headline: string;
  subline: string;
}

/** Satu halaman carousel. */
export interface Slide {
  order: number;
  type: 'cover' | 'content' | 'closing';
  title: string;
  body: string;
  /** Hanya halaman "cover" yang punya isi; sisanya string kosong. */
  imagePrompt: string;
}

/** Satu frame reels/shorts. */
export interface Frame {
  order: number;
  onscreen: string;
  voiceover: string;
  durationSec: number;
  imagePrompt: string;
}

/** Field yang ada di semua format. */
interface SpecBase {
  topic: string;
  hook: string;
  caption: string;
  cta: string;
  /** Tanpa tanda pagar, huruf kecil semua. */
  hashtags: string[];
}

export interface CarouselSpec extends SpecBase {
  format: 'carousel';
  slides: Slide[];
}

export interface FrameSpec extends SpecBase {
  format: 'reels' | 'shorts';
  onscreenText: OnscreenText;
  imagePrompt: string;
  frames: Frame[];
}

export interface SingleSpec extends SpecBase {
  format: 'story' | 'feed';
  onscreenText: OnscreenText;
  imagePrompt: string;
}

/**
 * Naskah hasil AI. Pakai `switch (spec.format)` untuk mempersempit tipenya —
 * TypeScript menolak akses `spec.slides` sebelum format dipastikan.
 */
export type ContentSpec = CarouselSpec | FrameSpec | SingleSpec;

/* --------------------------------------------------------------- ringkasan */

/** Baris konten untuk tab Library. */
export interface ContentSummary {
  contentId: string;
  createdAt: string;
  pillar: string;
  format: Format;
  topic: string;
  hook: string;
  caption: string;
  hashtags: string;
  imageProvider: string;
  textProvider: string;
  driveFileId: string;
  driveUrl: string;
  /** URL thumbnail Drive; string kosong kalau belum ada gambar. */
  thumb: string;
  slideCount: number;
  status: Status;
  scheduledAt: string;
}

/** Penyaring daftar konten. */
export interface ContentFilter {
  status?: Status;
  format?: Format;
  pillar?: string;
  limit?: number;
}
