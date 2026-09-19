import { describe, it, expect } from 'vitest';
import { hexToRgb, rgba, mix } from './color';

describe('hexToRgb', () => {
  it('mengurai hex panjang', () => {
    expect(hexToRgb('#C9A961')).toEqual({ r: 201, g: 169, b: 97 });
  });

  it('mengurai hex pendek', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('menerima tanpa tanda pagar', () => {
    expect(hexToRgb('2E3A45')).toEqual({ r: 46, g: 58, b: 69 });
  });

  it('warna merek yang salah ketik menghasilkan hitam, bukan error', () => {
    // Render tidak boleh batal hanya karena warna di sheet BRAND salah tulis.
    expect(() => hexToRgb('bukan-warna')).not.toThrow();
    expect(hexToRgb('')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('rgba', () => {
  it('menyusun string rgba yang sah', () => {
    expect(rgba('#C9A961', 0.5)).toBe('rgba(201,169,97,0.5)');
  });

  it('alpha 0 tetap ditulis', () => {
    expect(rgba('#000', 0)).toBe('rgba(0,0,0,0)');
  });
});

describe('mix', () => {
  it('t=0 menghasilkan warna pertama', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('rgb(0,0,0)');
  });

  it('t=1 menghasilkan warna kedua', () => {
    expect(mix('#000000', '#ffffff', 1)).toBe('rgb(255,255,255)');
  });

  it('t=0.5 menghasilkan titik tengah', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('rgb(128,128,128)');
  });

  it('selalu menghasilkan bilangan bulat', () => {
    const hasil = mix('#C9A961', '#2E3A45', 0.37);
    expect(hasil).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
  });
});
