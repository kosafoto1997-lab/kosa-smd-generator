/**
 * background.ts — Latar kanvas: foto kalau ada, prosedural kalau tidak.
 *
 * Latar prosedural adalah lapis terakhir rantai fallback gambar. Ia tidak
 * memanggil jaringan sama sekali, sehingga mustahil gagal — inilah yang
 * menjamin produksi konten tidak pernah benar-benar berhenti.
 */
import { mix, rgba } from './color';
import { drawImageCover } from './canvas';
import { brandValue, type Brand } from '@/types/brand';
import { DESIGN_LIMITS } from '@/types/design';

/** Tekstur halus supaya latar prosedural tidak terlihat datar. */
function drawNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opacity: number,
): void {
  const step = 3;
  ctx.save();
  ctx.globalAlpha = opacity;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = Math.random();
      if (v > 0.85) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(x, y, step, step);
      } else if (v < 0.06) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  ctx.restore();
}

/**
 * Kekuatan tiap lapisan latar prosedural.
 *
 * Nilai bawaan sengaja lembut agar teks tetap menonjol. Kalau hasilnya terasa
 * terlalu polos, naikkan angka di sini — bukan menambah lapisan baru.
 */
export const PROCEDURAL_INTENSITY = {
  /** Kemiringan gradasi utama terhadap warna aksen dan gelap. */
  gradientAccent: 0.1,
  gradientDeep: 0.14,
  /** Dua cahaya radial yang memberi kedalaman. */
  spotAccent: 0.16,
  spotDeep: 0.1,
  /** Garis diagonal tipis. */
  lines: 0.1,
  /** Bintik tekstur. */
  noise: 0.05,
} as const;

export type ProceduralIntensity = typeof PROCEDURAL_INTENSITY;

/**
 * Latar prosedural: gradasi + dua cahaya + garis diagonal + noise.
 *
 * @param seed menggeser posisi garis supaya dua halaman berurutan tidak
 *   terlihat identik.
 */
export function proceduralBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  brand: Brand,
  seed = 0,
  intensity: ProceduralIntensity = PROCEDURAL_INTENSITY,
): void {
  const bg = brandValue(brand, 'bgColor');
  const accent = brandValue(brand, 'primaryColor');
  const deep = brandValue(brand, 'secondaryColor');

  // Gradasi diagonal sebagai dasar.
  const g = ctx.createLinearGradient(0, 0, w * 0.6, h);
  g.addColorStop(0, mix(bg, accent, intensity.gradientAccent));
  g.addColorStop(0.55, bg);
  g.addColorStop(1, mix(bg, deep, intensity.gradientDeep));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Dua cahaya lembut supaya ada kedalaman.
  const spots = [
    { x: w * 0.78, y: h * 0.18, r: w * 0.62, c: accent, a: intensity.spotAccent },
    { x: w * 0.12, y: h * 0.82, r: w * 0.55, c: deep, a: intensity.spotDeep },
  ];

  for (const s of spots) {
    const rg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    rg.addColorStop(0, rgba(s.c, s.a));
    rg.addColorStop(1, rgba(s.c, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }

  // Ornamen garis tipis diagonal.
  ctx.save();
  ctx.globalAlpha = intensity.lines;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;

  const gap = 46;
  const offset = seed * 11;
  for (let i = -h; i < w + h; i += gap) {
    ctx.beginPath();
    ctx.moveTo(i + offset, 0);
    ctx.lineTo(i + offset - h, h);
    ctx.stroke();
  }
  ctx.restore();

  drawNoise(ctx, w, h, intensity.noise);
}

/**
 * Latar: foto kalau ada, kalau tidak latar prosedural.
 *
 * @param overlay Ketebalan lapisan gelap di atas foto. Tidak berlaku pada
 *   latar prosedural, yang kontrasnya sudah diatur lewat PROCEDURAL_INTENSITY.
 */
export function paintBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  img: HTMLImageElement | null,
  brand: Brand,
  seed = 0,
  // Anotasi eksplisit: tanpa itu `as const` di DESIGN_LIMITS menyempitkan
  // parameter ini ke tipe literal nilai bawaannya.
  overlay: number = DESIGN_LIMITS.overlay.default,
): void {
  if (img) {
    drawImageCover(ctx, img, 0, 0, w, h);
    // Penggelapan menyeluruh supaya warna teks konsisten di foto apa pun.
    ctx.fillStyle = `rgba(0,0,0,${overlay})`;
    ctx.fillRect(0, 0, w, h);
  } else {
    proceduralBackground(ctx, w, h, brand, seed);
  }
}
