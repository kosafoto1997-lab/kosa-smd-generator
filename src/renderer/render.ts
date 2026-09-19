/**
 * render.ts — Orkestrator: dari spec AI menjadi kumpulan gambar jadi.
 *
 * Satu-satunya fungsi yang dipanggil UI. Ia memilih layout sesuai format,
 * memuat gambar, lalu mengekspor tiap halaman sebagai data URL JPEG.
 */
import { makeCanvas, get2d, loadImage } from './canvas';
import { ensureFonts } from './fonts';
import {
  drawVertical,
  drawCover,
  drawContentSlide,
  drawClosingSlide,
} from './layout';
import { JPEG_QUALITY } from './constants';
import { CANVAS_SIZE, type ContentSpec, type Format } from '@/types/content';
import type { Brand } from '@/types/brand';
import { brandWithDesign, type DesignOverrides } from '@/types/design';

/** Satu gambar hasil render. */
export interface RenderedImage {
  /** Mulai dari 1, dipakai sebagai nomor halaman/frame saat menyimpan. */
  index: number;
  dataUrl: string;
  label: string;
}

export interface RenderJob {
  format: Format;
  brand: Brand;
  spec: ContentSpec;
  images: {
    /** Data URL gambar sampul; null berarti pakai latar prosedural. */
    cover: string | null;
    /** Data URL per frame reels/shorts; jatuh ke cover kalau kosong. */
    frames?: (string | null)[];
  };
  /** Nama pilar untuk label kapsul di sampul. */
  pillarName?: string;
  /** Penyetelan visual per konten; kosong berarti tampilan bawaan. */
  design?: DesignOverrides;
  onProgress?: (done: number, total: number) => void;
}

/** Ekspor canvas jadi data URL JPEG. */
function exportCanvas(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** Siapkan canvas beserta context sesuai format. */
function prepare(format: Format) {
  const { w, h } = CANVAS_SIZE[format];
  const canvas = makeCanvas(w, h);
  return { canvas, ctx: get2d(canvas) };
}

/**
 * Render seluruh gambar untuk satu konten.
 *
 * Font dimuat lebih dulu dan ditunggu sampai siap — tanpa itu halaman pertama
 * sering tergambar dengan font bawaan sistem.
 */
export async function renderAll(job: RenderJob): Promise<RenderedImage[]> {
  const { spec, images } = job;

  // Font pilihan penyunting menimpa yang tercatat di merek. Digabung di sini
  // supaya seluruh layout cukup membaca brand seperti biasa.
  const brand = brandWithDesign(job.brand, job.design);
  await ensureFonts(brand);

  const out: RenderedImage[] = [];
  const report = (done: number, total: number) => job.onProgress?.(done, total);

  // Logo dimuat sekali di awal, bukan per halaman: carousel tujuh halaman akan
  // memuat berkas yang sama tujuh kali tanpa ini.
  const logo = await loadImage(brand.logoDataUrl ?? null);

  // Disebar ke setiap layout. Dibungkus begini karena exactOptionalPropertyTypes
  // menolak `design: undefined` ditulis eksplisit.
  const styling = { ...(job.design ? { design: job.design } : {}), logo };

  switch (spec.format) {
    case 'carousel': {
      const coverImg = await loadImage(images.cover);
      const slides = spec.slides;

      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (!s) continue;

        const { canvas, ctx } = prepare('carousel');
        const type =
          s.type ?? (i === 0 ? 'cover' : i === slides.length - 1 ? 'closing' : 'content');

        if (type === 'cover') {
          drawCover(ctx, {
            brand,
            image: coverImg,
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

        const suffix =
          type === 'cover' ? ' (sampul)' : type === 'closing' ? ' (penutup)' : '';

        out.push({
          index: i + 1,
          dataUrl: exportCanvas(canvas),
          label: `Halaman ${i + 1}${suffix}`,
        });
        report(i + 1, slides.length);
      }
      return out;
    }

    case 'reels':
    case 'shorts': {
      const frames = spec.frames;

      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        if (!f) continue;

        // Gambar per frame kalau ada, kalau tidak pakai sampul yang sama.
        const src = images.frames?.[i] ?? images.cover;
        const img = await loadImage(src);

        const { canvas, ctx } = prepare(spec.format);
        drawVertical(ctx, {
          brand,
          image: img,
          headline: f.onscreen,
          totalFrames: frames.length,
          frameIndex: i,
          seed: i,
          ...styling,
        });

        out.push({
          index: i + 1,
          dataUrl: exportCanvas(canvas),
          label: `Frame ${i + 1} — ${f.durationSec || 3} detik`,
        });
        report(i + 1, frames.length);
      }
      return out;
    }

    case 'feed': {
      const img = await loadImage(images.cover);
      const { canvas, ctx } = prepare('feed');

      drawCover(ctx, {
        brand,
        image: img,
        title: spec.onscreenText.headline || spec.topic,
        body: spec.onscreenText.subline,
        badge: job.pillarName ?? '',
        showSwipe: false,
        seed: 1,
        ...styling,
      });

      out.push({ index: 1, dataUrl: exportCanvas(canvas), label: 'Post feed' });
      report(1, 1);
      return out;
    }

    case 'story': {
      const img = await loadImage(images.cover);
      const { canvas, ctx } = prepare('story');

      drawVertical(ctx, {
        brand,
        image: img,
        headline: spec.onscreenText.headline || spec.topic,
        subline: spec.onscreenText.subline,
        seed: 1,
        ...styling,
      });

      out.push({ index: 1, dataUrl: exportCanvas(canvas), label: 'Story' });
      report(1, 1);
      return out;
    }
  }
}

/** Buang awalan "data:image/jpeg;base64," sebelum dikirim ke backend. */
export function stripDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}
