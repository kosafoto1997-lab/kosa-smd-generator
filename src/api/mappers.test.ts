import { describe, it, expect } from 'vitest';
import { toBrand, fromBrand, toSpec, fromSpec, toContentSummary } from './mappers';

/**
 * Pemetaan snake_case (backend) <-> camelCase (UI) adalah tempat bug paling
 * mudah lolos: salah nama kunci tidak menimbulkan error, datanya hanya hilang
 * diam-diam. Tes ini menjaga perjalanan bolak-baliknya tetap utuh.
 */

describe('brand', () => {
  it('memetakan kunci sheet ke field UI', () => {
    const b = toBrand({
      brand_name: 'Nikahku Digital',
      ig_handle: '@nikahku.digital',
      primary_color: '#C9A961',
      font_heading: 'Playfair Display',
    });

    expect(b.brandName).toBe('Nikahku Digital');
    expect(b.igHandle).toBe('@nikahku.digital');
    expect(b.primaryColor).toBe('#C9A961');
    expect(b.fontHeading).toBe('Playfair Display');
  });

  it('field kosong tidak disertakan supaya nilai bawaan bisa berlaku', () => {
    const b = toBrand({ brand_name: 'X', ig_handle: '' });
    expect('igHandle' in b).toBe(false);
  });

  it('bolak-balik tidak mengubah isi', () => {
    const asli = {
      brand_name: 'Nikahku',
      ig_handle: '@nikahku',
      primary_color: '#C9A961',
      tone: 'hangat',
    };
    expect(fromBrand(toBrand(asli))).toEqual(asli);
  });
});

describe('toSpec', () => {
  it('carousel menghasilkan slides', () => {
    const spec = toSpec(
      {
        topic: 'Checklist',
        caption: 'isi',
        hashtags: ['nikah'],
        slides: [
          { order: 1, type: 'cover', title: 'Judul', body: 'isi', image_prompt: 'foto' },
        ],
      },
      'carousel',
    );

    expect(spec.format).toBe('carousel');
    if (spec.format === 'carousel') {
      expect(spec.slides[0]?.imagePrompt).toBe('foto');
      expect(spec.slides[0]?.type).toBe('cover');
    }
  });

  it('reels menghasilkan frames dengan durasi', () => {
    const spec = toSpec(
      {
        topic: 'T',
        caption: 'c',
        hashtags: [],
        frames: [{ order: 1, onscreen: 'hai', voiceover: 'vo', duration_sec: 4 }],
      },
      'reels',
    );

    expect(spec.format).toBe('reels');
    if (spec.format === 'reels') {
      expect(spec.frames[0]?.durationSec).toBe(4);
      expect(spec.frames[0]?.onscreen).toBe('hai');
    }
  });

  it('durasi kosong memakai 3 detik', () => {
    const spec = toSpec(
      { topic: 'T', caption: 'c', hashtags: [], frames: [{ onscreen: 'a' }] },
      'shorts',
    );
    if (spec.format === 'shorts') {
      expect(spec.frames[0]?.durationSec).toBe(3);
    }
  });

  it('story menghasilkan onscreenText', () => {
    const spec = toSpec(
      {
        topic: 'T',
        caption: 'c',
        hashtags: [],
        onscreen_text: { headline: 'Judul', subline: 'Sub' },
        image_prompt: 'p',
      },
      'story',
    );

    expect(spec.format).toBe('story');
    if (spec.format === 'story') {
      expect(spec.onscreenText.headline).toBe('Judul');
      expect(spec.imagePrompt).toBe('p');
    }
  });

  it('data backend yang kosong tidak membuat error', () => {
    expect(() => toSpec({}, 'carousel')).not.toThrow();
    expect(() => toSpec({}, 'story')).not.toThrow();
  });
});

describe('fromSpec', () => {
  it('mengembalikan image_prompt ke snake_case', () => {
    const spec = toSpec(
      {
        topic: 'T',
        caption: 'c',
        hashtags: [],
        onscreen_text: { headline: 'H', subline: 'S' },
        image_prompt: 'prompt gambar',
      },
      'feed',
    );

    const out = fromSpec(spec);
    // Backend membaca kunci ini; camelCase akan hilang diam-diam.
    expect(out['image_prompt']).toBe('prompt gambar');
    expect(out['onscreen_text']).toEqual({ headline: 'H', subline: 'S' });
  });

  it('slide carousel memakai image_prompt', () => {
    const spec = toSpec(
      {
        topic: 'T',
        caption: 'c',
        hashtags: [],
        slides: [{ order: 1, type: 'cover', title: 'J', body: 'b', image_prompt: 'foto' }],
      },
      'carousel',
    );

    const slides = fromSpec(spec)['slides'] as Array<Record<string, unknown>>;
    expect(slides[0]?.['image_prompt']).toBe('foto');
  });

  it('frame memakai duration_sec', () => {
    const spec = toSpec(
      {
        topic: 'T',
        caption: 'c',
        hashtags: [],
        frames: [{ order: 1, onscreen: 'a', duration_sec: 5 }],
      },
      'reels',
    );

    const frames = fromSpec(spec)['frames'] as Array<Record<string, unknown>>;
    expect(frames[0]?.['duration_sec']).toBe(5);
  });
});

describe('toContentSummary', () => {
  it('memetakan baris spreadsheet', () => {
    const c = toContentSummary({
      content_id: 'C1',
      format: 'carousel',
      topic: 'Judul',
      slide_count: 7,
      status: 'ready',
      drive_file_id: 'abc',
    });

    expect(c.contentId).toBe('C1');
    expect(c.slideCount).toBe(7);
    expect(c.status).toBe('ready');
  });

  it('status kosong dianggap draft', () => {
    expect(toContentSummary({ content_id: 'C1' }).status).toBe('draft');
  });

  it('angka yang bukan angka jadi 0', () => {
    expect(toContentSummary({ slide_count: 'bukan angka' }).slideCount).toBe(0);
  });
});
