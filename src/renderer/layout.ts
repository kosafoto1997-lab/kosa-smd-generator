/**
 * layout.ts — Empat jenis halaman yang bisa digambar.
 *
 * Angka-angka posisi di sini adalah hasil penyetelan visual, bukan rumus.
 * Yang penting dipahami: area aman Instagram. Story menyisakan 250 px di atas
 * (header) dan 320 px di bawah (kolom balasan) agar teks tidak tertutup UI.
 */
import { rgba } from './color';
import { fitText, fontStack } from './text';
import { drawLines, drawScrim } from './canvas';
import { paintBackground } from './background';
import {
  drawAccentBar,
  drawHandle,
  drawLogo,
  drawPageDots,
  drawPillBadge,
  drawProgressSegments,
  drawSwipeHint,
} from './elements';
import { brandValue, type Brand } from '@/types/brand';
import { DESIGN_LIMITS, type DesignOverrides } from '@/types/design';

interface Common {
  brand: Brand;
  image: HTMLImageElement | null;
  seed?: number;
  /** Penyetelan per konten; kosong berarti pakai angka bawaan. */
  design?: DesignOverrides;
  /** Logo merek yang sudah dimuat; null berarti pakai teks handle. */
  logo?: HTMLImageElement | null;
}

/** Tinggi logo di tiap layout, disamakan dengan tinggi optis teks handle. */
const LOGO_HEIGHT = 44;

/**
 * Tanda merek di kaki halaman: logo kalau ada, kalau tidak teks handle.
 *
 * Keduanya memakai titik jangkar yang sama persis, jadi mengganti salah satu
 * dengan yang lain tidak menggeser apa pun di sekitarnya.
 */
function drawMark(
  ctx: CanvasRenderingContext2D,
  o: Common,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign,
): void {
  if (o.design?.hideHandle) return;
  if (o.logo && drawLogo(ctx, o.logo, x, y, LOGO_HEIGHT, align) > 0) return;
  drawHandle(ctx, x, y, o.brand, color, align);
}

/* --------------------------------------------------- penerapan penyetelan */

/** Ukuran font sesudah dikalikan penyetelan pengguna. */
function scaled(design: DesignOverrides | undefined, size: number): number {
  return Math.round(size * (design?.fontScale ?? DESIGN_LIMITS.fontScale.default));
}

/**
 * Titik atas blok teks.
 *
 * Bawaan 'bawah' memakai angka hasil penyetelan visual yang dikirim pemanggil.
 * Dua posisi lain dihitung dari tinggi blok supaya teks sepanjang apa pun
 * tetap utuh di dalam kanvas.
 *
 * @param bottomTop Titik atas blok pada posisi bawaan 'bawah'.
 * @param safeTop Batas atas yang aman (di bawah header aplikasi).
 */
function blockTop(
  design: DesignOverrides | undefined,
  bottomTop: number,
  blockH: number,
  canvasH: number,
  safeTop: number,
): number {
  const pos = design?.textPosition ?? 'bawah';
  if (pos === 'bawah') return bottomTop;
  if (pos === 'atas') return safeTop;
  return Math.max(safeTop, (canvasH - blockH) / 2);
}

/** Perataan teks beserta titik x-nya, dihitung sekali untuk satu blok. */
function alignment(
  design: DesignOverrides | undefined,
  pad: number,
  canvasW: number,
): { align: 'left' | 'center'; x: number } {
  return (design?.textAlign ?? 'left') === 'center'
    ? { align: 'center', x: canvasW / 2 }
    : { align: 'left', x: pad };
}

export interface VerticalOptions extends Common {
  headline: string;
  subline?: string;
  /** Kalau lebih dari 1, batang progres digambar. */
  totalFrames?: number;
  frameIndex?: number;
}

export interface CoverOptions extends Common {
  title: string;
  body?: string;
  badge?: string;
  showSwipe?: boolean;
}

export interface ContentSlideOptions extends Common {
  number: number;
  title: string;
  body: string;
  total: number;
  index: number;
}

export interface ClosingSlideOptions extends Common {
  title: string;
  body: string;
  total: number;
  index: number;
}

/** Warna teks di atas latar terang. */
const TEXT_DARK = '#1C1C1C';

/**
 * Story / Reels / Shorts — 1080 x 1920.
 * Blok teks diletakkan di sepertiga bawah, tepat di atas area aman.
 */
export function drawVertical(
  ctx: CanvasRenderingContext2D,
  o: VerticalOptions,
): void {
  const W = 1080;
  const H = 1920;
  const PAD = 100;
  const CONTENT_W = W - PAD * 2;
  const { brand, design } = o;

  paintBackground(ctx, W, H, o.image, brand, o.seed ?? 0, design?.overlay);

  const BLOCK_BOTTOM = H - 360;

  const head = fitText(ctx, o.headline, {
    family: brandValue(brand, 'fontHeading'),
    weight: 700,
    isHeading: true,
    maxWidth: CONTENT_W,
    maxLines: 3,
    start: scaled(design, 92),
    min: scaled(design, 54),
    lineHeight: 1.16,
  });

  const sub = o.subline
    ? fitText(ctx, o.subline, {
        family: brandValue(brand, 'fontBody'),
        weight: 300,
        isHeading: false,
        maxWidth: CONTENT_W - 40,
        maxLines: 3,
        start: scaled(design, 44),
        min: scaled(design, 30),
        lineHeight: 1.45,
      })
    : null;

  const headH = head.lineHeight * head.lines.length;
  const subH = sub ? sub.lineHeight * sub.lines.length + 34 : 0;

  // Story menyisakan 250 px di atas untuk header aplikasi; teks yang digeser
  // ke atas tidak boleh masuk ke sana.
  const top = blockTop(design, BLOCK_BOTTOM - headH - subH, headH + subH, H, 300);
  const { align, x } = alignment(design, PAD, W);

  // Gradasi gelap menutupi blok teks plus ruang napas di atasnya.
  drawScrim(ctx, 0, top - 320, W, H - top + 320, 'up', 0.72);
  // Batang aksen mengikuti teks: rata tengah menaruhnya di tengah juga.
  drawAccentBar(ctx, align === 'center' ? W / 2 - 40 : PAD, top - 48, brand);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = fontStack(brandValue(brand, 'fontHeading'), 700, head.size, true);
  drawLines(ctx, head.lines, x, top, head.lineHeight, align);

  if (sub) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = fontStack(brandValue(brand, 'fontBody'), 300, sub.size, false);
    drawLines(ctx, sub.lines, x, top + headH + 34, sub.lineHeight, align);
  }

  const total = o.totalFrames ?? 0;
  const idx = o.frameIndex ?? 0;
  if (total > 1) {
    drawProgressSegments(ctx, W, 150, total, idx);
    ctx.save();
    ctx.font = fontStack(brandValue(brand, 'fontBody'), 500, 28, false);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'right';
    ctx.fillText(`${idx + 1}/${total}`, W - 70, 215);
    ctx.restore();
  }

  drawMark(ctx, o, PAD, H - 250, 'rgba(255,255,255,0.72)', 'left');
}

/** Halaman sampul carousel / post feed — 1080 x 1350. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  o: CoverOptions,
): void {
  const W = 1080;
  const H = 1350;
  const PAD = 90;
  const CONTENT_W = W - PAD * 2;
  const { brand, design } = o;

  paintBackground(ctx, W, H, o.image, brand, o.seed ?? 0, design?.overlay);
  drawScrim(ctx, 0, H * 0.3, W, H * 0.7, 'up', 0.78);

  if (o.badge && !design?.hideBadge) drawPillBadge(ctx, PAD, 90, o.badge, brand);

  const BLOCK_BOTTOM = o.showSwipe ? H - 210 : H - 170;

  const head = fitText(ctx, o.title, {
    family: brandValue(brand, 'fontHeading'),
    weight: 700,
    isHeading: true,
    maxWidth: CONTENT_W,
    maxLines: 3,
    start: scaled(design, 88),
    min: scaled(design, 52),
    lineHeight: 1.15,
  });

  const body = o.body
    ? fitText(ctx, o.body, {
        family: brandValue(brand, 'fontBody'),
        weight: 300,
        isHeading: false,
        maxWidth: CONTENT_W - 60,
        maxLines: 3,
        start: scaled(design, 40),
        min: scaled(design, 28),
        lineHeight: 1.45,
      })
    : null;

  const headH = head.lineHeight * head.lines.length;
  const bodyH = body ? body.lineHeight * body.lines.length + 30 : 0;

  // Batas atas menyisakan ruang untuk kapsul pilar, kecuali kapsulnya disembunyikan.
  const safeTop = o.badge && !design?.hideBadge ? 220 : 120;
  const top = blockTop(design, BLOCK_BOTTOM - headH - bodyH, headH + bodyH, H, safeTop);
  const { align, x } = alignment(design, PAD, W);

  drawAccentBar(ctx, align === 'center' ? W / 2 - 40 : PAD, top - 44, brand);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = fontStack(brandValue(brand, 'fontHeading'), 700, head.size, true);
  drawLines(ctx, head.lines, x, top, head.lineHeight, align);

  if (body) {
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = fontStack(brandValue(brand, 'fontBody'), 300, body.size, false);
    drawLines(ctx, body.lines, x, top + headH + 30, body.lineHeight, align);
  }

  drawMark(ctx, o, PAD, H - 70, 'rgba(255,255,255,0.7)', 'left');
  if (o.showSwipe) {
    drawSwipeHint(ctx, W - PAD, H - 82, brand, 'rgba(255,255,255,0.9)');
  }
}

/**
 * Halaman isi carousel — latar polos supaya teks paling terbaca.
 * Sengaja tanpa foto: untuk konten edukasi, tipografi bersih lebih efektif.
 */
export function drawContentSlide(
  ctx: CanvasRenderingContext2D,
  o: ContentSlideOptions,
): void {
  const W = 1080;
  const H = 1350;
  const PAD = 90;
  const CONTENT_W = W - PAD * 2;
  const { brand, design } = o;
  const accent = brandValue(brand, 'primaryColor');

  ctx.fillStyle = brandValue(brand, 'bgColor');
  ctx.fillRect(0, 0, W, H);

  // Aksen tipis di tepi kiri.
  ctx.fillStyle = rgba(accent, 0.9);
  ctx.fillRect(0, 0, 10, H);

  // Nomor besar sebagai penanda urutan.
  ctx.save();
  ctx.font = fontStack(brandValue(brand, 'fontHeading'), 700, 140, true);
  ctx.fillStyle = rgba(accent, 0.25);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(o.number), PAD, 250);
  ctx.restore();

  const title = fitText(ctx, o.title, {
    family: brandValue(brand, 'fontHeading'),
    weight: 700,
    isHeading: true,
    maxWidth: CONTENT_W,
    maxLines: 2,
    start: scaled(design, 62),
    min: scaled(design, 42),
    lineHeight: 1.2,
  });

  ctx.fillStyle = TEXT_DARK;
  ctx.font = fontStack(brandValue(brand, 'fontHeading'), 700, title.size, true);
  const titleTop = 320;
  const titleH = drawLines(ctx, title.lines, PAD, titleTop, title.lineHeight, 'left');

  // Garis pemisah.
  const dividerY = titleTop + titleH + 44;
  ctx.fillStyle = rgba(accent, 0.55);
  ctx.fillRect(PAD, dividerY, 120, 3);

  const body = fitText(ctx, o.body, {
    family: brandValue(brand, 'fontBody'),
    weight: 400,
    isHeading: false,
    maxWidth: CONTENT_W - 20,
    maxLines: 9,
    start: scaled(design, 40),
    min: scaled(design, 28),
    lineHeight: 1.55,
  });

  ctx.fillStyle = rgba(TEXT_DARK, 0.82);
  ctx.font = fontStack(brandValue(brand, 'fontBody'), 400, body.size, false);
  drawLines(ctx, body.lines, PAD, dividerY + 56, body.lineHeight, 'left');

  if (o.total > 1) drawPageDots(ctx, W / 2, H - 78, o.total, o.index, brand);
  drawMark(ctx, o, W - PAD, H - 68, rgba(TEXT_DARK, 0.42), 'right');
}

/**
 * Halaman penutup carousel — latar gelap.
 * Sengaja tanpa tombol dan tanpa harga: aturan soft-selling melarang ajakan
 * membeli langsung. Identitas merek muncul sebagai penutup cerita, bukan iklan.
 */
export function drawClosingSlide(
  ctx: CanvasRenderingContext2D,
  o: ClosingSlideOptions,
): void {
  const W = 1080;
  const H = 1350;
  const PAD = 90;
  const CONTENT_W = W - PAD * 2;
  const { brand, design } = o;
  const accent = brandValue(brand, 'primaryColor');

  ctx.fillStyle = brandValue(brand, 'secondaryColor');
  ctx.fillRect(0, 0, W, H);

  // Cahaya lembut di sudut supaya tidak terlihat datar.
  const rg = ctx.createRadialGradient(W * 0.85, H * 0.12, 0, W * 0.85, H * 0.12, W * 0.9);
  rg.addColorStop(0, rgba(accent, 0.2));
  rg.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  drawAccentBar(ctx, PAD, 300, brand);

  const title = fitText(ctx, o.title, {
    family: brandValue(brand, 'fontHeading'),
    weight: 700,
    isHeading: true,
    maxWidth: CONTENT_W,
    maxLines: 3,
    start: scaled(design, 76),
    min: scaled(design, 48),
    lineHeight: 1.18,
  });

  ctx.fillStyle = '#FFFFFF';
  ctx.font = fontStack(brandValue(brand, 'fontHeading'), 700, title.size, true);
  const titleTop = 360;
  const titleH = drawLines(ctx, title.lines, PAD, titleTop, title.lineHeight, 'left');

  const body = fitText(ctx, o.body, {
    family: brandValue(brand, 'fontBody'),
    weight: 300,
    isHeading: false,
    maxWidth: CONTENT_W - 40,
    maxLines: 5,
    start: scaled(design, 42),
    min: scaled(design, 30),
    lineHeight: 1.5,
  });

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = fontStack(brandValue(brand, 'fontBody'), 300, body.size, false);
  drawLines(ctx, body.lines, PAD, titleTop + titleH + 40, body.lineHeight, 'left');

  // Identitas di bagian bawah.
  ctx.save();
  ctx.font = fontStack(brandValue(brand, 'fontHeading'), 600, 46, true);
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.fillText(brand.brandName ?? '', PAD, H - 200);

  if (brand.website) {
    ctx.font = fontStack(brandValue(brand, 'fontBody'), 400, 34, false);
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText(brand.website, PAD, H - 148);
  }
  ctx.restore();

  drawMark(ctx, o, PAD, H - 80, 'rgba(255,255,255,0.45)', 'left');
  if (o.total > 1) {
    // Latar gelap: titik tidak aktif harus terang supaya tetap terlihat.
    drawPageDots(ctx, W / 2, H - 40, o.total, o.index, brand, '#FFFFFF');
  }
}
