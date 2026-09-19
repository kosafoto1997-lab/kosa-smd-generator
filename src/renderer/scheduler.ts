/**
 * scheduler.ts — Menggabungkan banyak permintaan gambar jadi satu per frame.
 *
 * Slider dan kotak teks menyala jauh lebih sering daripada layar menyegarkan
 * diri. Tanpa penggabungan, satu tarikan slider memicu puluhan render penuh
 * yang hasilnya sudah basi sebelum sempat tampil — layar tersendat justru
 * karena terlalu banyak menggambar.
 *
 * Permintaan terakhir selalu menang: `pending` ditimpa terus, jadi frame yang
 * akhirnya menyala pasti memakai keadaan terbaru. Itu sekaligus membatalkan
 * render usang tanpa perlu penomoran versi.
 *
 * Pola yang sama dipakai Konva (`batchDraw`), Fabric (`requestRenderAll`), dan
 * Excalidraw (`throttleRAF`). Sengaja bukan debounce: debounce menunda gambar
 * sampai gerakan berhenti, sehingga pratinjau terasa tertinggal saat diseret.
 */

export interface Scheduler<T> {
  /** Jadwalkan gambar dengan data terbaru; aman dipanggil sesering apa pun. */
  request(job: T): void;
  /** Gambar sekarang juga, melewati antrean frame. */
  flush(): void;
  /** Buang yang tertunda. Wajib dipanggil saat komponen dilepas. */
  cancel(): void;
}

export function createScheduler<T>(draw: (job: T) => void): Scheduler<T> {
  let frame: number | null = null;
  let pending: T | null = null;

  function run(): void {
    frame = null;
    const job = pending;
    pending = null;
    if (job !== null) draw(job);
  }

  return {
    request(job: T): void {
      pending = job;
      if (frame === null) frame = requestAnimationFrame(run);
    },

    flush(): void {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      run();
    },

    cancel(): void {
      pending = null;
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    },
  };
}
