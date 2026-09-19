/**
 * withDrafts.ts — Terapkan teks yang sedang disunting ke spec.
 *
 * Spec-lah yang dibaca renderer, jadi perubahan teks harus masuk ke sana —
 * bukan ditumpangkan belakangan di atas hasil gambar.
 *
 * Terpisah dari `useEditor` karena pratinjau live memakainya di tiap ketikan,
 * sementara `useEditor` hanya saat menyimpan. Keduanya wajib memakai fungsi
 * yang sama: pratinjau yang berbeda dari berkas tersimpan lebih buruk
 * daripada tidak ada pratinjau.
 */
import type { ContentSpec } from '@/types/content';

/** Teks satu halaman sebagaimana sedang disunting. */
export interface SlideDraft {
  order: number;
  title: string;
  body: string;
}

export function withDrafts(spec: ContentSpec, drafts: SlideDraft[]): ContentSpec {
  const byOrder = new Map(drafts.map((d) => [d.order, d]));

  if (spec.format === 'carousel') {
    return {
      ...spec,
      slides: spec.slides.map((s) => {
        const d = byOrder.get(s.order);
        return d ? { ...s, title: d.title, body: d.body } : s;
      }),
    };
  }

  // Format satu halaman: halaman pertama memetakan ke teks di atas gambar.
  const first = drafts[0];
  if (!first) return spec;

  const onscreenText = { headline: first.title, subline: first.body };

  if (spec.format === 'reels' || spec.format === 'shorts') {
    return {
      ...spec,
      onscreenText,
      frames: spec.frames.map((f) => {
        const d = byOrder.get(f.order);
        return d ? { ...f, onscreen: d.title } : f;
      }),
    };
  }

  return { ...spec, onscreenText };
}
