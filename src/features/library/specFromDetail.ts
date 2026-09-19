/**
 * specFromDetail.ts — Rakit ulang spec dari data yang tersimpan.
 *
 * Spreadsheet menyimpan hasil akhir per halaman, bukan spec mentah dari AI,
 * jadi bentuknya perlu disusun kembali sebelum bisa dirender. Dipakai oleh
 * render ulang maupun duplikasi.
 */
import type { ContentSpec, Slide } from '@/types/content';
import type { ContentDetail } from '@/types/api';

export function specFromDetail(d: ContentDetail): ContentSpec {
  const c = d.content;
  const base = {
    topic: c.topic,
    hook: c.hook,
    caption: c.caption,
    cta: c.cta,
    hashtags: c.hashtags
      .split(/\s+/)
      .map((h) => h.replace(/^#/, ''))
      .filter(Boolean),
  };

  if (c.format === 'carousel') {
    return {
      ...base,
      format: 'carousel',
      slides: d.slides.map((s) => ({
        order: s.order,
        type: s.type as Slide['type'],
        title: s.title,
        body: s.body,
        imagePrompt: '',
      })),
    };
  }

  if (c.format === 'reels' || c.format === 'shorts') {
    return {
      ...base,
      format: c.format,
      onscreenText: { headline: c.hook || c.topic, subline: '' },
      imagePrompt: '',
      frames: d.slides.map((s) => ({
        order: s.order,
        onscreen: s.title || s.body,
        voiceover: s.body,
        durationSec: 3,
        imagePrompt: '',
      })),
    };
  }

  return {
    ...base,
    format: c.format === 'feed' ? 'feed' : 'story',
    onscreenText: { headline: c.hook || c.topic, subline: '' },
    imagePrompt: '',
  };
}
