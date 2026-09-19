import { describe, it, expect } from 'vitest';
import { wrapText, breakLongWord, fitText, fontStack, type TextMeasurer } from './text';

/**
 * Pengukur teks tiruan: lebar = jumlah karakter x lebar per karakter, diskalakan
 * dengan ukuran font yang sedang aktif. Cukup untuk memeriksa logika pemecahan
 * baris tanpa butuh canvas sungguhan.
 */
function makeMeasurer(charWidth = 10): TextMeasurer {
  return {
    font: '400 100px sans-serif',
    measureText(text: string) {
      const m = /(\d+)px/.exec(this.font);
      const size = m ? Number(m[1]) : 100;
      return { width: text.length * charWidth * (size / 100) };
    },
  };
}

describe('wrapText', () => {
  it('memecah kalimat jadi beberapa baris', () => {
    const ctx = makeMeasurer();
    const lines = wrapText(ctx, 'satu dua tiga empat lima', 100);

    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((l) => expect(ctx.measureText(l).width).toBeLessThanOrEqual(100));
  });

  it('teks kosong menghasilkan array kosong', () => {
    expect(wrapText(makeMeasurer(), '', 100)).toEqual([]);
    expect(wrapText(makeMeasurer(), '   ', 100)).toEqual([]);
  });

  it('tidak pernah menghasilkan baris kosong', () => {
    const lines = wrapText(makeMeasurer(), 'a  b   c', 100);
    expect(lines.every((l) => l.length > 0)).toBe(true);
  });

  it('BUG YANG PERNAH ADA: satu kata lebih panjang dari kolom tetap muat', () => {
    const ctx = makeMeasurer();
    // 30 karakter x 10px = 300px, sedangkan kolom cuma 100px.
    const lines = wrapText(ctx, 'pertanggungjawabankebijaksanaan', 100);

    lines.forEach((l) =>
      expect(ctx.measureText(l).width).toBeLessThanOrEqual(100),
    );
  });

  it('URL panjang tanpa spasi tetap muat', () => {
    const ctx = makeMeasurer();
    const lines = wrapText(ctx, 'https://contoh.id/undangan/digital/paket', 100);

    lines.forEach((l) =>
      expect(ctx.measureText(l).width).toBeLessThanOrEqual(100),
    );
  });

  it('mempertahankan seluruh isi teks', () => {
    const lines = wrapText(makeMeasurer(), 'satu dua tiga empat', 100);
    expect(lines.join(' ')).toBe('satu dua tiga empat');
  });
});

describe('breakLongWord', () => {
  it('memecah jadi potongan yang semuanya muat', () => {
    const ctx = makeMeasurer();
    const chunks = breakLongWord(ctx, 'abcdefghijklmnopqrst', 50);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(ctx.measureText(c).width).toBeLessThanOrEqual(50));
  });

  it('menyatukan kembali jadi kata asli', () => {
    const chunks = breakLongWord(makeMeasurer(), 'abcdefghij', 30);
    expect(chunks.join('')).toBe('abcdefghij');
  });

  it('kata yang sudah muat tidak dipecah', () => {
    expect(breakLongWord(makeMeasurer(), 'abc', 100)).toEqual(['abc']);
  });
});

describe('fitText', () => {
  const opts = {
    family: 'Inter',
    start: 100,
    min: 20,
    maxWidth: 200,
    maxLines: 2,
  };

  it('memakai ukuran awal kalau teks pendek', () => {
    const hasil = fitText(makeMeasurer(), 'ok', opts);
    expect(hasil.size).toBe(100);
  });

  it('menurunkan ukuran supaya teks panjang muat', () => {
    const hasil = fitText(
      makeMeasurer(),
      'kalimat yang cukup panjang sehingga harus dikecilkan dulu',
      opts,
    );
    expect(hasil.size).toBeLessThan(100);
    expect(hasil.lines.length).toBeLessThanOrEqual(2);
  });

  it('memberi elipsis kalau sudah di ukuran minimum', () => {
    const teks = 'kata '.repeat(200);
    const hasil = fitText(makeMeasurer(), teks, opts);

    expect(hasil.size).toBe(20);
    expect(hasil.lines.length).toBe(2);
    expect(hasil.lines[1]).toMatch(/…$/);
  });

  it('tidak pernah melebihi maxLines', () => {
    const teks = 'kata '.repeat(200);
    const hasil = fitText(makeMeasurer(), teks, { ...opts, maxLines: 3 });
    expect(hasil.lines.length).toBeLessThanOrEqual(3);
  });

  it('setiap baris muat dalam maxWidth', () => {
    const ctx = makeMeasurer();
    const hasil = fitText(ctx, 'beberapa kata yang lumayan panjang di sini', opts);

    ctx.font = `400 ${hasil.size}px Inter`;
    hasil.lines.forEach((l) =>
      expect(ctx.measureText(l).width).toBeLessThanOrEqual(opts.maxWidth),
    );
  });

  it('teks kosong tidak membuat error', () => {
    const hasil = fitText(makeMeasurer(), '', opts);
    expect(hasil.lines).toEqual([]);
  });

  it('lineHeight sebanding dengan ukuran font', () => {
    const hasil = fitText(makeMeasurer(), 'ok', opts);
    expect(hasil.lineHeight).toBe(Math.round(hasil.size * 1.18));
  });
});

describe('fontStack', () => {
  it('judul memakai fallback serif', () => {
    expect(fontStack('Playfair Display', 700, 92, true)).toContain('serif');
  });

  it('isi memakai fallback sans-serif', () => {
    expect(fontStack('Inter', 400, 44, false)).toContain('sans-serif');
  });

  it('berbentuk deklarasi font CSS yang sah', () => {
    expect(fontStack('Inter', 600, 44, false)).toBe(
      '600 44px "Inter", "Helvetica Neue", Arial, sans-serif',
    );
  });
});
