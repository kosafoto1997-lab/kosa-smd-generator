/**
 * Nama berkas disusun dari topik konten — teks bebas yang ditulis manusia atau
 * dihasilkan AI. Karakter terlarang di dalamnya membuat unduhan gagal tanpa
 * pesan apa pun di Windows dan Android, jadi pembersihan di sini adalah
 * satu-satunya yang berdiri di antara topik liar dan unduhan yang hilang.
 */
import { describe, it, expect } from 'vitest';
import { safeName } from './download';

describe('safeName — karakter yang ditolak sistem berkas', () => {
  it('membuang karakter terlarang Windows', () => {
    expect(safeName('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('mengubah spasi jadi tanda hubung', () => {
    expect(safeName('kesalahan menulis nama')).toBe('kesalahan-menulis-nama');
  });

  it('merapatkan tanda hubung beruntun', () => {
    expect(safeName('a   b')).toBe('a-b');
  });

  it('membuang tanda hubung dan titik di ujung', () => {
    // Nama berakhiran titik ditolak Windows, dan berawalan titik jadi
    // berkas tersembunyi di sistem mirip Unix.
    expect(safeName('...rahasia...')).toBe('rahasia');
    expect(safeName('--topik--')).toBe('topik');
  });
});

describe('safeName — masukan yang tidak menyisakan apa pun', () => {
  it('memakai cadangan untuk teks kosong', () => {
    expect(safeName('')).toBe('konten');
    expect(safeName('   ')).toBe('konten');
  });

  it('memakai cadangan kalau semua karakter dibuang', () => {
    expect(safeName('///:::')).toBe('konten');
  });

  it('menghormati cadangan yang diberikan pemanggil', () => {
    expect(safeName('', 'gambar')).toBe('gambar');
  });
});

describe('safeName — panjang', () => {
  it('memotong nama yang terlalu panjang', () => {
    // Batas panjang nama berkas berbeda-beda per sistem; 60 karakter aman di
    // semuanya sekaligus masih terbaca manusia.
    const out = safeName('a'.repeat(200));
    expect(out.length).toBe(60);
  });

  it('tidak menyisakan tanda hubung di ujung setelah dipotong', () => {
    // Pemotongan bisa mendarat tepat di tanda hubung; hasilnya tetap harus
    // berupa nama yang sah.
    const out = safeName(`${'a'.repeat(59)} bbb`);
    expect(out.endsWith('-')).toBe(false);
  });
});

describe('safeName — teks Indonesia sungguhan', () => {
  it('mempertahankan huruf dan angka', () => {
    expect(safeName('5 Kesalahan Undangan Digital')).toBe(
      '5-Kesalahan-Undangan-Digital',
    );
  });

  it('menangani tanda baca yang lazim di judul', () => {
    expect(safeName('Undangan digital vs cetak: mana hemat?')).toBe(
      'Undangan-digital-vs-cetak-mana-hemat',
    );
  });
});
