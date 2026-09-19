/**
 * elements.ts — Elemen dekoratif yang dipakai berulang di beberapa layout.
 */
import { rgba } from './color';
import { fontStack } from './text';
import { brandValue, type Brand } from '@/types/brand';

/** Batang aksen pendek sebagai penanda awal blok teks. */
export function drawAccentBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brand: Brand,
): void {
  ctx.fillStyle = brandValue(brand, 'primaryColor');
  ctx.fillRect(x, y, 90, 6);
}

/**
 * Logo merek pada tinggi tertentu, rasio aslinya dipertahankan.
 *
 * @param y Garis dasar, sama dengan yang dipakai teks handle — supaya logo
 *   dan teks bisa saling menggantikan tanpa menggeser tata letak.
 * @return Lebar yang tergambar; 0 kalau tidak ada logo.
 */
export function drawLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  height: number,
  align: CanvasTextAlign = 'left',
): number {
  // Gambar rusak punya dimensi nol; membaginya menghasilkan NaN dan seluruh
  // halaman gagal tergambar tanpa pesan apa pun.
  if (!img.naturalWidth || !img.naturalHeight) return 0;

  const w = (img.naturalWidth / img.naturalHeight) * height;
  const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;

  // y adalah garis dasar teks, jadi gambarnya diletakkan di atasnya.
  ctx.drawImage(img, left, y - height, w, height);
  return w;
}

/** Handle Instagram dengan jarak antar huruf. */
export function drawHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brand: Brand,
  color: string,
  align: CanvasTextAlign = 'left',
): void {
  const text = brand.igHandle;
  if (!text) return;

  ctx.save();
  ctx.font = fontStack(brandValue(brand, 'fontBody'), 500, 32, false);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';

  // letter-spacing manual: canvas tidak punya properti ini di semua browser.
  const spaced = text.toLowerCase().split('').join(' ');
  ctx.fillText(spaced, x, y);
  ctx.restore();
}

/** Label berbentuk kapsul, dipakai untuk nama pilar di halaman sampul. */
export function drawPillBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  brand: Brand,
): void {
  if (!label) return;

  ctx.save();
  ctx.font = fontStack(brandValue(brand, 'fontBody'), 600, 26, false);

  const padX = 26;
  const padY = 15;
  const text = label.toUpperCase();
  const w = ctx.measureText(text).width + padX * 2;
  const h = 26 + padY * 2;
  const r = h / 2;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = brandValue(brand, 'primaryColor');
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.restore();
}

/** Titik penanda halaman carousel. */
export function drawPageDots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  total: number,
  active: number,
  brand: Brand,
  inactiveColor = '#1C1C1C',
): void {
  const gap = 22;
  const r = 6;
  let x = cx - ((total - 1) * gap) / 2;

  for (let i = 0; i < total; i++) {
    ctx.beginPath();
    ctx.arc(x, y, i === active ? r + 2 : r, 0, Math.PI * 2);
    ctx.fillStyle =
      i === active ? brandValue(brand, 'primaryColor') : rgba(inactiveColor, 0.22);
    ctx.fill();
    x += gap;
  }
}

/** Batang progres bergaya Instagram Story untuk reels/shorts. */
export function drawProgressSegments(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  total: number,
  active: number,
): void {
  const margin = 70;
  const gap = 10;
  const segW = (w - margin * 2 - gap * (total - 1)) / total;
  let x = margin;

  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i <= active ? '#FFFFFF' : 'rgba(255,255,255,0.34)';
    ctx.fillRect(x, y, segW, 5);
    x += segW + gap;
  }
}

/**
 * Petunjuk "Geser" untuk carousel.
 * Panahnya digambar manual supaya tidak bergantung pada font emoji yang
 * ketersediaannya berbeda antar perangkat.
 */
export function drawSwipeHint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brand: Brand,
  color: string,
): void {
  ctx.save();
  ctx.font = fontStack(brandValue(brand, 'fontBody'), 500, 32, false);
  ctx.fillStyle = color;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('Geser', x - 46, y);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 34, y);
  ctx.lineTo(x - 6, y);
  ctx.moveTo(x - 16, y - 10);
  ctx.lineTo(x - 6, y);
  ctx.lineTo(x - 16, y + 10);
  ctx.stroke();
  ctx.restore();
}
