/**
 * useBatch.ts — Membuat banyak konten sekali duduk.
 *
 * Keluhan terbesar pemakai tool sejenis bukan soal membuat konten itu sulit,
 * melainkan harus memikirkan "hari ini posting apa" setiap hari. Sekali duduk
 * menghasilkan stok sebulan menjawab itu langsung.
 *
 * Tiga keputusan yang membentuk berkas ini:
 *
 * 1. **Berurutan, bukan berbarengan.** Tiap konten memakai kuota AI dan
 *    menulis ke spreadsheet yang sama. Menjalankan lima sekaligus akan
 *    menabrak batas laju provider dan mengunci sheet.
 * 2. **Kegagalan satu konten tidak menghentikan sisanya.** Kuota habis di
 *    tengah jalan adalah kejadian normal; sepuluh konten yang jadi tujuh
 *    jauh lebih berguna daripada nol.
 * 3. **Bisa dihentikan.** Pekerjaan ini berjalan menit-menitan, dan orang
 *    berhak berubah pikiran tanpa harus menutup tab.
 */
import { useCallback, useRef, useState } from 'react';
import { produceOne, type ProduceArgs } from './produce';
import { planBatch, type BatchSlot, type PillarWeight } from './planBatch';
import type { Brand } from '@/types/brand';
import type { Format } from '@/types/content';

/** Hasil satu konten dalam antrean. */
export interface BatchItem {
  seq: number;
  pillarName: string;
  state: 'menunggu' | 'jalan' | 'selesai' | 'gagal' | 'batal';
  /** Terisi setelah selesai; dipakai untuk membuka konten dari daftar. */
  contentId?: string;
  topic?: string;
  note?: string;
}

export interface BatchArgs {
  format: Format;
  count: number;
  skipImage: boolean;
  perFrame: boolean;
  /** Jumlah halaman/frame per konten. */
  slides: number;
}

export interface BatchState {
  running: boolean;
  items: BatchItem[];
  /** Nomor konten yang sedang dikerjakan, 0 kalau belum mulai. */
  current: number;
  done: number;
  failed: number;
}

const IDLE: BatchState = {
  running: false,
  items: [],
  current: 0,
  done: 0,
  failed: 0,
};

export function useBatch(brand: Brand, pillars: PillarWeight[], pillarName: (id: string) => string) {
  const [state, setState] = useState<BatchState>(IDLE);

  /**
   * Penanda berhenti dibaca di sela tiap konten.
   *
   * Dipakai ref, bukan state: nilai state akan terbekukan di dalam closure
   * yang sedang berjalan, sehingga penghentian tidak pernah terbaca.
   */
  const stopped = useRef(false);

  const stop = useCallback(() => {
    stopped.current = true;
  }, []);

  const reset = useCallback(() => {
    stopped.current = false;
    setState(IDLE);
  }, []);

  /** Ubah satu baris antrean tanpa menyentuh yang lain. */
  function patch(seq: number, patchItem: Partial<BatchItem>) {
    setState((s) => ({
      ...s,
      items: s.items.map((it) => (it.seq === seq ? { ...it, ...patchItem } : it)),
    }));
  }

  const run = useCallback(
    async (args: BatchArgs) => {
      const slots: BatchSlot[] = planBatch(args.count, pillars);
      if (slots.length === 0) return;

      stopped.current = false;
      setState({
        running: true,
        current: 0,
        done: 0,
        failed: 0,
        items: slots.map((s) => ({
          seq: s.seq,
          pillarName: s.pillarName,
          state: 'menunggu',
        })),
      });

      for (const slot of slots) {
        if (stopped.current) {
          // Sisa antrean ditandai batal, bukan gagal: tidak ada yang rusak.
          setState((s) => ({
            ...s,
            items: s.items.map((it) =>
              it.state === 'menunggu' ? { ...it, state: 'batal' } : it,
            ),
          }));
          break;
        }

        setState((s) => ({ ...s, current: slot.seq }));
        patch(slot.seq, { state: 'jalan' });

        const one: ProduceArgs = {
          format: args.format,
          pillar: slot.pillarId,
          // Topik dikosongkan supaya backend memilih dari bank ide. Itu inti
          // gunanya: pemakai tidak perlu memikirkan topik sama sekali.
          topic: '',
          count: args.slides,
          skipImage: args.skipImage,
          perFrame: args.perFrame,
        };

        try {
          const out = await produceOne(one, brand, pillarName, (step, note) => {
            const labels = ['naskah', 'gambar', 'render', 'menyimpan'];
            const label = labels[step] ?? 'memproses';
            patch(slot.seq, { note: note ? `${label}: ${note}` : label });
          });

          patch(slot.seq, {
            state: 'selesai',
            contentId: out.contentId,
            topic: out.spec.topic,
            note: '',
          });
          setState((s) => ({ ...s, done: s.done + 1 }));
        } catch (e) {
          // Satu konten gagal tidak menghentikan sisanya — kuota habis di
          // tengah jalan adalah kejadian yang memang diperkirakan.
          const msg = e instanceof Error ? e.message : String(e);
          patch(slot.seq, { state: 'gagal', note: msg });
          setState((s) => ({ ...s, failed: s.failed + 1 }));
        }
      }

      setState((s) => ({ ...s, running: false, current: 0 }));
    },
    [brand, pillars, pillarName],
  );

  return { ...state, run, stop, reset };
}
