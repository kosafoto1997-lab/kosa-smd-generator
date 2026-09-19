/**
 * Penjadwal inilah yang membuat pratinjau terasa seketika tanpa tersendat.
 * Kalau ia salah, gejalanya halus dan sulit dilacak: pratinjau tertinggal satu
 * langkah dari setelan, atau menggambar jauh lebih sering daripada perlu.
 *
 * requestAnimationFrame tidak ada di lingkungan pengujian, jadi di sini ia
 * ditiru dengan antrean yang dijalankan manual — sekaligus membuat pengujian
 * "banyak permintaan dalam satu frame" bisa ditulis dengan pasti.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createScheduler } from './scheduler';

let queue: Array<() => void> = [];
let nextId = 1;

/** Jalankan semua callback yang menunggu frame berikutnya. */
function tick(): void {
  const pending = queue;
  queue = [];
  pending.forEach((fn) => fn());
}

beforeEach(() => {
  queue = [];
  nextId = 1;

  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
    queue.push(fn);
    return nextId++;
  });

  vi.stubGlobal('cancelAnimationFrame', () => {
    // Pembatalan diwakili dengan mengosongkan antrean pada `cancel()`;
    // yang diuji di sini adalah tidak adanya panggilan gambar, bukan
    // bookkeeping id-nya.
    queue = [];
  });
});

describe('createScheduler', () => {
  it('tidak menggambar sebelum frame menyala', () => {
    const draw = vi.fn();
    createScheduler(draw).request('a');

    expect(draw).not.toHaveBeenCalled();
  });

  it('menggambar sekali saat frame menyala', () => {
    const draw = vi.fn();
    createScheduler(draw).request('a');

    tick();
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenCalledWith('a');
  });

  it('menggabungkan banyak permintaan dalam satu frame jadi satu gambar', () => {
    // Inilah alasan penjadwal ini ada: satu tarikan slider bisa memicu puluhan
    // permintaan, dan menggambar semuanya justru membuat layar tersendat.
    const draw = vi.fn();
    const s = createScheduler(draw);

    s.request('a');
    s.request('b');
    s.request('c');

    tick();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('memakai permintaan TERAKHIR, bukan yang pertama', () => {
    // Kalau yang pertama yang menang, pratinjau akan tertinggal dari setelan.
    const draw = vi.fn();
    const s = createScheduler(draw);

    s.request('lama');
    s.request('baru');

    tick();
    expect(draw).toHaveBeenCalledWith('baru');
  });

  it('menjadwalkan frame baru untuk permintaan setelah frame sebelumnya usai', () => {
    const draw = vi.fn();
    const s = createScheduler(draw);

    s.request('a');
    tick();
    s.request('b');
    tick();

    expect(draw).toHaveBeenCalledTimes(2);
    expect(draw).toHaveBeenNthCalledWith(2, 'b');
  });

  it('tidak menggambar apa pun kalau tidak ada permintaan', () => {
    const draw = vi.fn();
    createScheduler(draw);

    tick();
    expect(draw).not.toHaveBeenCalled();
  });
});

describe('cancel', () => {
  it('membatalkan gambar yang belum sempat menyala', () => {
    // Dipanggil saat panel ditutup. Menggambar ke canvas yang sudah dilepas
    // React akan melempar.
    const draw = vi.fn();
    const s = createScheduler(draw);

    s.request('a');
    s.cancel();
    tick();

    expect(draw).not.toHaveBeenCalled();
  });

  it('aman dipanggil berkali-kali tanpa permintaan tertunda', () => {
    const s = createScheduler(vi.fn());
    expect(() => {
      s.cancel();
      s.cancel();
    }).not.toThrow();
  });
});

describe('flush', () => {
  it('menggambar segera tanpa menunggu frame', () => {
    const draw = vi.fn();
    const s = createScheduler(draw);

    s.request('a');
    s.flush();

    expect(draw).toHaveBeenCalledWith('a');
  });

  it('tidak menggambar dua kali saat frame menyusul', () => {
    const draw = vi.fn();
    const s = createScheduler(draw);

    s.request('a');
    s.flush();
    tick();

    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('tidak melakukan apa-apa kalau tidak ada yang tertunda', () => {
    const draw = vi.fn();
    createScheduler(draw).flush();

    expect(draw).not.toHaveBeenCalled();
  });
});
