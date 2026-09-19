/**
 * produce.ts — Alur produksi satu konten, tanpa React.
 *
 * Diangkat keluar dari `useGenerate` supaya pembuatan massal bisa memakai
 * jalur yang persis sama. Dua salinan alur ini akan berbeda perlahan-lahan,
 * dan perbedaannya baru ketahuan sebagai konten yang tersimpan setengah jadi.
 *
 * PENTING: keempat langkah TIDAK boleh digabung jadi satu panggilan. Batas
 * eksekusi Apps Script 6 menit; carousel 7 halaman sekaligus pasti timeout.
 *
 *   1. generateText     naskah + caption + prompt gambar
 *   2. fetchImage       ambil gambar (diulang per halaman bila perlu)
 *   3. render           menggambar di browser
 *   4. uploadRendered   simpan tiap hasil, lalu saveContent
 */
import { fetchImage, fromSpec, generateText, saveContent, uploadRendered } from '@/api';
import { renderAll, stripDataUrl, type RenderedImage } from '@/renderer';
import type { Brand } from '@/types/brand';
import type { ContentSpec, Format } from '@/types/content';
import type { Attempt } from '@/types/provider';

export interface ProduceArgs {
  format: Format;
  pillar: string;
  topic: string;
  count: number;
  /** Lewati AI gambar, langsung pakai latar tipografi. Tidak memakai kuota. */
  skipImage: boolean;
  /** Ambil gambar terpisah untuk tiap frame reels/shorts. */
  perFrame: boolean;
}

export interface ProduceResult {
  contentId: string;
  spec: ContentSpec;
  images: RenderedImage[];
  imageProvider: string;
  textProvider: string;
  pillar: string;
  /**
   * Kata terlarang yang dibersihkan otomatis dari caption.
   *
   * Bukti bahwa aturan soft-selling bekerja — ditampilkan sebagai informasi,
   * bukan peringatan kesalahan.
   */
  sanitized: string[];
}

/**
 * Laporan kemajuan.
 *
 * `step` mulai dari 0 sesuai urutan di atas. `done` menandai langkah itu
 * selesai — dinyatakan tegas, bukan ditebak dari ada tidaknya catatan, karena
 * sebuah langkah bisa melaporkan kemajuan berkali-kali sebelum usai.
 */
export type ProgressFn = (step: number, note?: string, done?: boolean) => void;

/** Ringkas daftar percobaan jadi satu baris, misal "gemini gagal → groq ✓". */
export function describe(attempts: Attempt[]): string {
  if (attempts.length === 0) return '';
  return attempts
    .map((a) => {
      if (a.ok) return `${a.provider} ✓`;
      if (a.skipped) return `${a.provider} dilewati`;
      return `${a.provider} gagal`;
    })
    .join(' → ');
}

/** Provider yang akhirnya berhasil. */
export function winner(attempts: Attempt[], fallback: string): string {
  return attempts.find((a) => a.ok)?.provider ?? fallback;
}

/**
 * Daftar prompt gambar yang perlu diambil.
 *
 * Carousel hanya butuh satu (sampulnya saja — halaman isi sengaja memakai
 * latar polos agar teks paling terbaca). Reels/shorts bisa satu gambar untuk
 * semua frame, atau satu per frame kalau diminta.
 */
export function imagePrompts(spec: ContentSpec, perFrame: boolean): string[] {
  if (spec.format === 'carousel') {
    return [spec.slides[0]?.imagePrompt ?? ''];
  }
  if ((spec.format === 'reels' || spec.format === 'shorts') && perFrame) {
    return spec.frames.map((f) => f.imagePrompt || spec.imagePrompt);
  }
  return [spec.imagePrompt];
}

/**
 * Hasilkan satu konten dari awal sampai tersimpan.
 *
 * Melempar kalau gagal; pemanggil yang memutuskan apakah itu menghentikan
 * seluruh pekerjaan atau cukup dilewati.
 */
export async function produceOne(
  args: ProduceArgs,
  brand: Brand,
  pillarName: (id: string) => string,
  onProgress: ProgressFn = () => {},
): Promise<ProduceResult> {
  /* --- Langkah 1: naskah --- */
  onProgress(0);
  const text = await generateText({
    format: args.format,
    pillar: args.pillar,
    topic: args.topic,
    count: args.count,
  });
  onProgress(0, describe(text.attempts), true);

  const { spec, contentId } = text;

  /* --- Langkah 2: gambar --- */
  onProgress(1);
  let cover: string | null = null;
  const frames: (string | null)[] = [];
  let imageProvider = 'local';

  if (args.skipImage) {
    onProgress(1, 'dilewati sesuai pilihan, dipakai latar tipografi', true);
  } else {
    const prompts = imagePrompts(spec, args.perFrame);
    const notes: string[] = [];

    for (let i = 0; i < prompts.length; i++) {
      const img = await fetchImage({
        prompt: prompts[i] ?? prompts[0] ?? '',
        contentId,
        index: i + 1,
        format: args.format,
      });

      if (i === 0) {
        cover = img.dataUrl;
        imageProvider = winner(img.attempts, img.provider);
      }
      frames.push(img.dataUrl);
      notes.push(describe(img.attempts));
    }
    onProgress(1, notes[0] ?? '', true);
  }

  /* --- Langkah 3: render di browser --- */
  onProgress(2);
  const images = await renderAll({
    format: args.format,
    brand,
    spec,
    images: { cover, frames },
    pillarName: pillarName(text.pillar),
    onProgress: (done, total) => onProgress(2, `${done}/${total} halaman`),
  });
  onProgress(2, `${images.length} gambar`, true);

  /* --- Langkah 4: simpan --- */
  onProgress(3);
  const uploaded: Array<{ index: number; fileId: string; url: string }> = [];

  for (const img of images) {
    const up = await uploadRendered({
      contentId,
      format: args.format,
      index: img.index,
      base64: stripDataUrl(img.dataUrl),
    });
    uploaded.push({ index: img.index, fileId: up.fileId, url: up.url });
    onProgress(3, `${uploaded.length}/${images.length} tersimpan`);
  }

  const textProvider = winner(text.attempts, 'template');

  await saveContent({
    content_id: contentId,
    format: args.format,
    pillar: text.pillar,
    spec: fromSpec(spec),
    image_provider: imageProvider,
    text_provider: textProvider,
    files: uploaded,
  });
  onProgress(3, 'tersimpan', true);

  return {
    contentId,
    spec,
    images,
    imageProvider,
    textProvider,
    pillar: text.pillar,
    sanitized: text.sanitized ?? [],
  };
}
