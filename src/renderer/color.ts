/**
 * color.ts — Utilitas warna untuk renderer.
 *
 * Fungsi murni tanpa ketergantungan pada canvas maupun DOM, sehingga bisa
 * diuji langsung.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Urai warna hex jadi komponen RGB.
 * Menerima bentuk pendek (#abc) maupun panjang (#aabbcc), dengan atau tanpa
 * tanda pagar. Nilai tidak valid menghasilkan hitam, bukan melempar error —
 * warna merek yang salah ketik tidak boleh membatalkan render.
 */
export function hexToRgb(hex: string): Rgb {
  const h = String(hex || '#000000').replace('#', '').trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;

  return {
    r: parseInt(full.substring(0, 2), 16) || 0,
    g: parseInt(full.substring(2, 4), 16) || 0,
    b: parseInt(full.substring(4, 6), 16) || 0,
  };
}

/** Warna hex jadi string rgba() dengan alpha tertentu. */
export function rgba(hex: string, alpha: number): string {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

/**
 * Campur dua warna hex.
 * @param t 0 menghasilkan `a`, 1 menghasilkan `b`.
 */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const r = Math.round(x.r + (y.r - x.r) * t);
  const g = Math.round(x.g + (y.g - x.g) * t);
  const bl = Math.round(x.b + (y.b - x.b) * t);
  return `rgb(${r},${g},${bl})`;
}
