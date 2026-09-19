/**
 * Logo digambar dari berkas yang diunggah pengguna, jadi bentuknya tidak bisa
 * diandalkan: bisa sangat lebar, sangat tinggi, atau gagal dimuat sama sekali.
 * Gambar yang gagal dimuat punya dimensi nol — membaginya menghasilkan NaN,
 * dan `drawImage` dengan NaN membuat seluruh halaman gagal tergambar tanpa
 * pesan kesalahan apa pun.
 */
import { describe, it, expect, vi } from 'vitest';
import { drawLogo } from './elements';

/** Context palsu yang hanya mencatat apa yang digambar. */
function fakeCtx() {
  return { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D & {
    drawImage: ReturnType<typeof vi.fn>;
  };
}

/** Gambar palsu dengan dimensi yang bisa diatur. */
function fakeImg(w: number, h: number) {
  return { naturalWidth: w, naturalHeight: h } as HTMLImageElement;
}

describe('drawLogo — gambar yang tidak sah', () => {
  it('tidak menggambar apa pun kalau lebarnya nol', () => {
    const ctx = fakeCtx();
    expect(drawLogo(ctx, fakeImg(0, 100), 0, 0, 44)).toBe(0);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('tidak menggambar apa pun kalau tingginya nol', () => {
    const ctx = fakeCtx();
    expect(drawLogo(ctx, fakeImg(100, 0), 0, 0, 44)).toBe(0);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('tidak pernah meneruskan NaN ke drawImage', () => {
    // Inilah kegagalan yang dicegah: NaN membuat canvas berhenti menggambar
    // tanpa melempar apa pun, jadi halamannya keluar kosong.
    const ctx = fakeCtx();
    drawLogo(ctx, fakeImg(0, 0), 10, 10, 44);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawLogo — ukuran', () => {
  it('mempertahankan rasio asli pada tinggi yang diminta', () => {
    const ctx = fakeCtx();
    // 200x100 pada tinggi 44 seharusnya jadi 88x44.
    expect(drawLogo(ctx, fakeImg(200, 100), 0, 0, 44)).toBe(88);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, -44, 88, 44);
  });

  it('menangani logo yang lebih tinggi daripada lebar', () => {
    const ctx = fakeCtx();
    expect(drawLogo(ctx, fakeImg(50, 100), 0, 0, 44)).toBe(22);
  });
});

describe('drawLogo — penjangkaran', () => {
  const img = fakeImg(200, 100); // lebarnya 88 pada tinggi 44

  it('rata kiri menaruh tepi kiri di x', () => {
    const ctx = fakeCtx();
    drawLogo(ctx, img, 90, 500, 44, 'left');
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 90, 456, 88, 44);
  });

  it('rata kanan menaruh tepi kanan di x', () => {
    const ctx = fakeCtx();
    drawLogo(ctx, img, 990, 500, 44, 'right');
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 902, 456, 88, 44);
  });

  it('rata tengah memusatkan logo pada x', () => {
    const ctx = fakeCtx();
    drawLogo(ctx, img, 540, 500, 44, 'center');
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 496, 456, 88, 44);
  });

  it('menaruh logo di atas garis dasar, bukan di bawahnya', () => {
    // y adalah garis dasar teks yang digantikan logo ini; menggambar dari y ke
    // bawah akan menaruhnya di luar kanvas pada kaki halaman.
    const ctx = fakeCtx();
    drawLogo(ctx, img, 0, 1280, 44);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 1236, 88, 44);
  });
});
