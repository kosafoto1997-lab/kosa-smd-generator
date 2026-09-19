/**
 * useDownload.ts — Simpan konten ke perangkat, siap diposting.
 *
 * Tanpa ini, konten yang sudah dibuat tidak pernah benar-benar keluar dari
 * aplikasi: memposting ke Instagram atau Status WhatsApp menuntut berkasnya
 * ada di galeri ponsel lebih dulu.
 *
 * Gambar digambar ulang di browser alih-alih diambil dari Drive. Terdengar
 * memutar, tapi justru ini jalur yang benar:
 *
 * - URL thumbnail Drive mengembalikan versi kecil, bukan berkas penuh.
 * - Memuat URL Drive ke canvas membuatnya ter-taint, sehingga tidak bisa
 *   diekspor sama sekali.
 * - Hasil gambar ulang selalu cocok dengan setelan terbaru.
 *
 * Tidak memakai kuota AI: yang diambil hanya gambar mentah yang sudah
 * tersimpan, persis seperti `useRerender`.
 */
import { useCallback, useState } from 'react';
import { getContent, getRawImage } from '@/api';
import { renderAll } from '@/renderer';
import { specFromDetail } from './specFromDetail';
import { downloadDataUrl, downloadZipOf, isInAppBrowser, safeName } from '@/lib/download';
import type { Brand } from '@/types/brand';
import type { Format } from '@/types/content';

export interface DownloadState {
  running: boolean;
  note: string;
  error: Error | null;
  /**
   * Peringatan bahwa peramban dalam aplikasi akan membuang unduhan diam-diam.
   * Bukan error: unduhannya tetap dicoba, pengguna hanya perlu tahu jalan
   * keluarnya kalau tidak terjadi apa-apa.
   */
  warning: string;
}

/** Ekstensi berkas mengikuti keluaran renderer, yang selalu JPEG. */
const EXT = 'jpg';

export function useDownload(brand: Brand) {
  const [state, setState] = useState<DownloadState>({
    running: false,
    note: '',
    error: null,
    warning: '',
  });

  const run = useCallback(
    async (contentId: string, pillarName?: string) => {
      setState({
        running: true,
        note: 'Memuat data konten…',
        error: null,
        warning: isInAppBrowser()
          ? 'Kamu membuka halaman ini dari dalam aplikasi lain. Kalau unduhan tidak muncul, buka tautannya di Chrome atau Safari.'
          : '',
      });

      try {
        const detail = await getContent(contentId);
        const format = detail.content.format as Format;
        const spec = specFromDetail(detail);
        const topic = detail.content.topic || contentId;

        setState((s) => ({ ...s, note: 'Mengambil gambar tersimpan…' }));
        const raw = await getRawImage(contentId, 1);

        setState((s) => ({ ...s, note: 'Menggambar ulang…' }));
        const images = await renderAll({
          format,
          brand,
          spec,
          images: { cover: raw.dataUrl },
          ...(pillarName ? { pillarName } : {}),
          onProgress: (done, total) =>
            setState((s) => ({ ...s, note: `Menggambar ${done}/${total} halaman…` })),
        });

        const base = safeName(topic, contentId);

        if (images.length === 1) {
          // Satu gambar tidak perlu dibungkus arsip — membuka ZIP berisi satu
          // berkas justru menambah langkah di ponsel.
          const only = images[0];
          if (only) downloadDataUrl(only.dataUrl, `${base}.${EXT}`);
        } else {
          setState((s) => ({ ...s, note: 'Menyusun arsip…' }));
          await downloadZipOf(
            images.map((img) => ({
              // Nomor diberi nol di depan supaya urutannya tetap benar saat
              // berkas diurutkan menurut nama di galeri ponsel.
              name: `${base}-${String(img.index).padStart(2, '0')}.${EXT}`,
              dataUrl: img.dataUrl,
            })),
            `${base}.zip`,
          );
        }

        setState((s) => ({
          ...s,
          running: false,
          note:
            images.length === 1
              ? 'Gambar diunduh.'
              : `${images.length} gambar diunduh sebagai satu berkas ZIP.`,
        }));
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setState((s) => ({ ...s, running: false, note: '', error: err }));
      }
    },
    [brand],
  );

  return { ...state, run };
}
