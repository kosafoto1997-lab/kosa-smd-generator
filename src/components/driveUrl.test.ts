/**
 * Aturan ukuran di sini pernah membuat lightbox menampilkan kotak rusak:
 * lebar yang diminta melebihi yang mau dihasilkan Drive, dan Drive membalas
 * kesalahan alih-alih gambar yang lebih kecil. Tes ini menjaga dua hal —
 * penulisan ulang URL-nya benar, dan lebarnya tidak naik diam-diam.
 */
import { describe, it, expect } from 'vitest';
import { bigger, MAX_THUMB_WIDTH } from './driveUrl';

const DRIVE = 'https://drive.google.com/thumbnail?id=1AbC_dEf&sz=w400';

describe('bigger — URL thumbnail Drive', () => {
  it('mengganti lebar yang diminta', () => {
    expect(bigger(DRIVE)).toBe(
      `https://drive.google.com/thumbnail?id=1AbC_dEf&sz=w${MAX_THUMB_WIDTH}`,
    );
  });

  it('mempertahankan id berkasnya', () => {
    expect(bigger(DRIVE)).toContain('id=1AbC_dEf');
  });

  it('bekerja saat sz jadi parameter pertama', () => {
    const url = 'https://drive.google.com/thumbnail?sz=w400&id=1AbC_dEf';
    expect(bigger(url)).toBe(
      `https://drive.google.com/thumbnail?sz=w${MAX_THUMB_WIDTH}&id=1AbC_dEf`,
    );
  });

  it('bekerja pada URL yang sudah dibubuhi penanda percobaan ulang', () => {
    // Thumb menambahkan &retry=1 saat memuat ulang; lightbox bisa menerima
    // URL dalam bentuk itu.
    const url = `${DRIVE}&retry=1`;
    expect(bigger(url)).toBe(
      `https://drive.google.com/thumbnail?id=1AbC_dEf&sz=w${MAX_THUMB_WIDTH}&retry=1`,
    );
  });

  it('tidak menaikkan lebar melewati batas yang diketahui aman', () => {
    // Batasnya bukan angka hiasan: melampauinya membuat gambar gagal dimuat.
    expect(MAX_THUMB_WIDTH).toBeLessThanOrEqual(1000);
  });
});

describe('bigger — sumber selain Drive', () => {
  it('membiarkan data URL apa adanya', () => {
    // Hasil render di browser sudah beresolusi penuh.
    const data = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    expect(bigger(data)).toBe(data);
  });

  it('membiarkan URL Drive yang bukan thumbnail apa adanya', () => {
    const view = 'https://drive.google.com/file/d/1AbC_dEf/view';
    expect(bigger(view)).toBe(view);
  });

  it('membiarkan string kosong apa adanya', () => {
    expect(bigger('')).toBe('');
  });
});
