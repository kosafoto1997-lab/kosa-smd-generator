/**
 * Penyetelan desain datang dari kolom `notes` di spreadsheet — teks bebas yang
 * bisa saja diketik manusia, tersisa dari versi lama, atau rusak. Renderer
 * tidak punya perlindungan sendiri terhadap angka liar, jadi pembersihan di
 * sini adalah satu-satunya yang berdiri di antara data buruk dan gambar rusak.
 */
import { describe, it, expect } from 'vitest';
import { brandWithDesign, DESIGN_LIMITS, isDefaultDesign, sanitizeDesign } from './design';

describe('sanitizeDesign — masukan tidak berbentuk', () => {
  it('mengembalikan objek kosong untuk null dan undefined', () => {
    expect(sanitizeDesign(null)).toEqual({});
    expect(sanitizeDesign(undefined)).toEqual({});
  });

  it('mengembalikan objek kosong untuk tipe selain objek', () => {
    expect(sanitizeDesign('Salinan dari C123')).toEqual({});
    expect(sanitizeDesign(42)).toEqual({});
    expect(sanitizeDesign(true)).toEqual({});
  });

  it('membuang kunci yang tidak dikenal', () => {
    expect(sanitizeDesign({ warna: 'merah', textPosition: 'atas' })).toEqual({
      textPosition: 'atas',
    });
  });
});

describe('sanitizeDesign — nilai pilihan', () => {
  it('menerima tiga posisi yang sah', () => {
    for (const p of ['atas', 'tengah', 'bawah'] as const) {
      expect(sanitizeDesign({ textPosition: p }).textPosition).toBe(p);
    }
  });

  it('menolak posisi di luar daftar', () => {
    expect(sanitizeDesign({ textPosition: 'miring' }).textPosition).toBeUndefined();
  });

  it('menerima perataan yang sah dan menolak sisanya', () => {
    expect(sanitizeDesign({ textAlign: 'center' }).textAlign).toBe('center');
    expect(sanitizeDesign({ textAlign: 'right' }).textAlign).toBeUndefined();
  });
});

describe('sanitizeDesign — angka', () => {
  it('menjepit fontScale yang kelewat besar ke batas atas', () => {
    // Inilah kasus yang menggambar teks jauh di luar kanvas kalau lolos.
    expect(sanitizeDesign({ fontScale: 50 }).fontScale).toBe(DESIGN_LIMITS.fontScale.max);
  });

  it('menjepit fontScale negatif ke batas bawah', () => {
    expect(sanitizeDesign({ fontScale: -3 }).fontScale).toBe(DESIGN_LIMITS.fontScale.min);
  });

  it('membiarkan nilai di dalam rentang apa adanya', () => {
    expect(sanitizeDesign({ fontScale: 1.2 }).fontScale).toBe(1.2);
    expect(sanitizeDesign({ overlay: 0.5 }).overlay).toBe(0.5);
  });

  it('menjepit overlay ke rentangnya', () => {
    expect(sanitizeDesign({ overlay: 5 }).overlay).toBe(DESIGN_LIMITS.overlay.max);
    expect(sanitizeDesign({ overlay: -1 }).overlay).toBe(DESIGN_LIMITS.overlay.min);
  });

  it('menolak NaN dan Infinity', () => {
    expect(sanitizeDesign({ fontScale: NaN }).fontScale).toBeUndefined();
    expect(sanitizeDesign({ overlay: Infinity }).overlay).toBeUndefined();
  });

  it('menolak angka yang datang sebagai teks', () => {
    // JSON.parse mengembalikan string kalau nilainya ditulis berkutip.
    expect(sanitizeDesign({ fontScale: '1.2' }).fontScale).toBeUndefined();
  });
});

describe('sanitizeDesign — saklar', () => {
  it('hanya menerima true, bukan nilai yang sekadar truthy', () => {
    expect(sanitizeDesign({ hideBadge: true }).hideBadge).toBe(true);
    expect(sanitizeDesign({ hideBadge: 'ya' }).hideBadge).toBeUndefined();
    expect(sanitizeDesign({ hideBadge: 1 }).hideBadge).toBeUndefined();
  });

  it('menghilangkan false alih-alih menyimpannya', () => {
    // Field yang tidak ada berarti "pakai bawaan"; menyimpan false membuat
    // isDefaultDesign salah menganggap konten ini sudah disetel.
    expect(sanitizeDesign({ hideBadge: false })).toEqual({});
  });
});

describe('sanitizeDesign — nama font', () => {
  it('menerima nama font yang wajar', () => {
    expect(sanitizeDesign({ fontHeading: 'Playfair Display' })).toEqual({
      fontHeading: 'Playfair Display',
    });
    expect(sanitizeDesign({ fontBody: 'Source Sans 3' })).toEqual({
      fontBody: 'Source Sans 3',
    });
  });

  it('memangkas spasi di ujung', () => {
    expect(sanitizeDesign({ fontHeading: '  Lora  ' })).toEqual({ fontHeading: 'Lora' });
  });

  it('membuang tanda kutip yang akan merusak deklarasi ctx.font', () => {
    // `ctx.font` adalah string CSS. Tanda kutip di tengah nama membuat seluruh
    // deklarasi tidak sah, dan canvas menolaknya tanpa pesan apa pun — seluruh
    // teks lalu tergambar dengan font bawaan sistem.
    expect(sanitizeDesign({ fontHeading: 'Lora", sans-serif; x:"' })).toEqual({
      fontHeading: 'Lora sans-serif x',
    });
  });

  it('menolak nama kosong dan yang isinya hanya simbol', () => {
    expect(sanitizeDesign({ fontHeading: '' })).toEqual({});
    expect(sanitizeDesign({ fontHeading: '   ' })).toEqual({});
    expect(sanitizeDesign({ fontHeading: '«»' })).toEqual({});
  });

  it('menolak nama yang kepanjangan', () => {
    expect(sanitizeDesign({ fontBody: 'A'.repeat(200) })).toEqual({});
  });

  it('menolak tipe selain teks', () => {
    expect(sanitizeDesign({ fontHeading: 42 })).toEqual({});
    expect(sanitizeDesign({ fontBody: ['Inter'] })).toEqual({});
  });
});

describe('brandWithDesign', () => {
  const brand = { fontHeading: 'Playfair Display', fontBody: 'Inter' };

  it('mengembalikan objek yang sama persis kalau tidak ada override font', () => {
    // Identitas dijaga supaya React tidak menganggap brand berubah di tiap
    // render dan menggambar ulang kanvas tanpa alasan.
    expect(brandWithDesign(brand, {})).toBe(brand);
    expect(brandWithDesign(brand, { fontScale: 1.2 })).toBe(brand);
  });

  it('menimpa hanya font yang disetel', () => {
    expect(brandWithDesign(brand, { fontHeading: 'Lora' })).toEqual({
      fontHeading: 'Lora',
      fontBody: 'Inter',
    });
  });

  it('menimpa keduanya sekaligus', () => {
    expect(brandWithDesign(brand, { fontHeading: 'Cinzel', fontBody: 'Karla' })).toEqual({
      fontHeading: 'Cinzel',
      fontBody: 'Karla',
    });
  });

  it('tidak mengubah brand aslinya', () => {
    brandWithDesign(brand, { fontHeading: 'Lora' });
    expect(brand.fontHeading).toBe('Playfair Display');
  });
});

describe('isDefaultDesign', () => {
  it('true untuk objek kosong', () => {
    expect(isDefaultDesign({})).toBe(true);
  });

  it('false begitu ada satu penyetelan', () => {
    expect(isDefaultDesign({ textAlign: 'center' })).toBe(false);
  });

  it('true untuk masukan rusak yang sudah dibersihkan', () => {
    expect(isDefaultDesign(sanitizeDesign({ fontScale: 'besar' }))).toBe(true);
  });
});
