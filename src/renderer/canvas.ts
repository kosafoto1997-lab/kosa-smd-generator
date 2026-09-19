/**
 * canvas.ts — Utilitas canvas dan pemuatan gambar.
 */

/** Buat canvas lepas dengan ukuran tertentu. */
export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Ambil context 2D, atau lempar kalau tidak tersedia.
 * Kegagalan di sini artinya browser terlalu tua atau kehabisan memori — bukan
 * sesuatu yang bisa dipulihkan diam-diam.
 */
export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia di browser ini.');
  return ctx;
}

/**
 * Muat gambar dari data URL.
 *
 * Sengaja TIDAK pernah menolak (reject): gambar yang gagal dimuat bukan alasan
 * membatalkan render — pemanggil cukup memakai latar prosedural sebagai
 * gantinya.
 *
 * Sumbernya selalu data URL karena gambar diambil di sisi server. Kalau
 * browser memuat URL eksternal langsung, canvas akan ter-taint dan
 * toDataURL() gagal.
 */
export function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Gambar memenuhi kotak tanpa gepeng, dipotong terpusat.
 * Setara `object-fit: cover` di CSS.
 */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;

  let sw: number;
  let sh: number;
  let sx: number;
  let sy: number;

  if (imgRatio > boxRatio) {
    // Gambar lebih lebar dari kotak: potong kiri-kanan.
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    // Gambar lebih tinggi: potong atas-bawah.
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** Gambar kumpulan baris teks, kembalikan tinggi total yang terpakai. */
export function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  topY: number,
  lineHeight: number,
  align: CanvasTextAlign = 'left',
): number {
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';

  lines.forEach((line, i) => {
    // Geser 0.22 tinggi baris supaya baseline tampak seimbang secara optis.
    ctx.fillText(line, x, topY + lineHeight * (i + 1) - lineHeight * 0.22);
  });

  return lineHeight * lines.length;
}

/** Gradasi gelap supaya teks tetap terbaca di atas foto apa pun. */
export function drawScrim(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  direction: 'up' | 'down',
  maxAlpha = 0.62,
): void {
  const g =
    direction === 'up'
      ? ctx.createLinearGradient(0, y + h, 0, y)
      : ctx.createLinearGradient(0, y, 0, y + h);

  g.addColorStop(0, `rgba(0,0,0,${maxAlpha})`);
  g.addColorStop(0.55, `rgba(0,0,0,${maxAlpha * 0.45})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}
