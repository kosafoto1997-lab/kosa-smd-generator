/**
 * live.ts — Menggambar SATU halaman langsung ke canvas yang terlihat.
 *
 * Bedanya dengan `renderAll()` ada tiga, dan ketiganya yang membuat pratinjau
 * terasa seketika:
 *
 * 1. **Tidak ada `toDataURL`.** Mengubah kanvas 1080×1350 jadi JPEG memakan
 *    puluhan milidetik dan sama sekali tidak dibutuhkan untuk dilihat — canvas
 *    itu sendiri sudah ada di halaman.
 * 2. **Gambar diterima sudah jadi `HTMLImageElement`.** Mengurai ulang data URL
 *    tiap frame itu mahal; pemanggil memuatnya sekali lalu memakainya terus.
 * 3. **Hanya halaman yang sedang dilihat.** Carousel tujuh halaman mustahil
 *    digambar ulang seluruhnya di tiap gerakan slider.
 *
 * Hasilnya wajib sama persis dengan `renderAll()` untuk halaman yang sama —
 * pratinjau yang berbeda dari berkas tersimpan lebih buruk daripada tidak ada
 * pratinjau. Karena itu pemilihan layout di sini mengikuti aturan yang sama.
 */
import { get2d } from './canvas';
import {
  drawVertical,
  drawCover,
  drawContentSlide,
  drawClosingSlide,
} from './layout';
import { CANVAS_SIZE, type ContentSpec, type Format } from '@/types/content';
import type { Brand } from '@/types/brand';
import { brandWithDesign, type DesignOverrides } from '@/types/design';

export interface LiveJob {
  format: Format;
  brand: Brand;
  spec: ContentSpec;
  /** Sudah dimuat. Null berarti pakai latar prosedural. */
  image: HTMLImageElement | null;
  /** Halaman yang digambar, mulai dari 0. */
  pageIndex: number;
  pillarName?: string;
  design?: DesignOverrides;
}

/** Berapa halaman yang dipunyai satu konten — dipakai penomoran thumbnail. */
export function pageCount(spec: ContentSpec): number {
  if (spec.format === 'carousel') return spec.slides.length;
  if (spec.format === 'reels' || spec.format === 'shorts') return spec.frames.length;
  return 1;
}

/** Label halaman, sama dengan yang dipakai `renderAll()`. */
export function pageLabel(spec: ContentSpec, i: number): string {
  if (spec.format === 'carousel') {
    const total = spec.slides.length;
    const type = spec.slides[i]?.type ?? (i === 0 ? 'cover' : i === total - 1 ? 'closing' : 'content');
    const suffix = type === 'cover' ? ' (sampul)' : type === 'closing' ? ' (penutup)' : '';
    return `Halaman ${i + 1}${suffix}`;
  }
  if (spec.format === 'reels' || spec.format === 'shorts') {
    return `Frame ${i + 1} — ${spec.frames[i]?.durationSec || 3} detik`;
  }
  return spec.format === 'story' ? 'Story' : 'Post feed';
}

/**
 * Samakan ukuran backing store canvas dengan format, lalu gambar.
 *
 * `scale` di bawah 1 mengecilkan jumlah piksel yang digambar sementara ukuran
 * tampilnya tetap diatur CSS — dipakai selama slider ditarik, saat mata tidak
 * sempat menangkap kelembutannya.
 */
export function drawPage(canvas: HTMLCanvasElement, job: LiveJob, scale = 1): void {
  const { w, h } = CANVAS_SIZE[job.format];
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);

  // Mengubah width/height membersihkan canvas sekaligus; hanya disetel saat
  // berubah supaya tidak memicu alokasi ulang di tiap frame.
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }

  const ctx = get2d(canvas);
  ctx.save();
  ctx.clearRect(0, 0, pw, ph);
  // Layout menggambar memakai koordinat ukuran penuh; penskalaan di sini
  // membuatnya tidak perlu tahu soal mode hemat sama sekali.
  if (scale !== 1) ctx.scale(scale, scale);

  paint(ctx, job);
  ctx.restore();
}

/** Pemilihan layout. Aturannya harus tetap cocok dengan `renderAll()`. */
function paint(ctx: CanvasRenderingContext2D, job: LiveJob): void {
  const { spec, image, pageIndex: i } = job;
  const brand = brandWithDesign(job.brand, job.design);
  const styling = job.design ? { design: job.design } : {};

  switch (spec.format) {
    case 'carousel': {
      const slides = spec.slides;
      const s = slides[i];
      if (!s) return;

      const type =
        s.type ?? (i === 0 ? 'cover' : i === slides.length - 1 ? 'closing' : 'content');

      if (type === 'cover') {
        drawCover(ctx, {
          brand,
          image,
          title: s.title,
          body: s.body,
          badge: job.pillarName ?? '',
          showSwipe: slides.length > 1,
          seed: i,
          ...styling,
        });
      } else if (type === 'closing') {
        drawClosingSlide(ctx, {
          brand,
          image: null,
          title: s.title,
          body: s.body,
          index: i,
          total: slides.length,
          ...styling,
        });
      } else {
        drawContentSlide(ctx, {
          brand,
          image: null,
          number: i,
          title: s.title,
          body: s.body,
          index: i,
          total: slides.length,
          ...styling,
        });
      }
      return;
    }

    case 'reels':
    case 'shorts': {
      const f = spec.frames[i];
      if (!f) return;

      drawVertical(ctx, {
        brand,
        image,
        headline: f.onscreen,
        totalFrames: spec.frames.length,
        frameIndex: i,
        seed: i,
        ...styling,
      });
      return;
    }

    case 'feed':
      drawCover(ctx, {
        brand,
        image,
        title: spec.onscreenText.headline || spec.topic,
        body: spec.onscreenText.subline,
        badge: job.pillarName ?? '',
        showSwipe: false,
        seed: 1,
        ...styling,
      });
      return;

    case 'story':
      drawVertical(ctx, {
        brand,
        image,
        headline: spec.onscreenText.headline || spec.topic,
        subline: spec.onscreenText.subline,
        seed: 1,
        ...styling,
      });
  }
}
