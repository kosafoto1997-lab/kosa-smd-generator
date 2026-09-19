/**
 * useRerender.ts — Render ulang konten tanpa memanggil AI sama sekali.
 *
 * Gambar mentah dari AI disimpan di folder 99_Raw_AI saat konten pertama
 * dibuat. Dengan mengambilnya kembali, halaman bisa digambar ulang memakai
 * teks atau identitas merek yang sudah diperbarui — **tanpa menghabiskan
 * kuota AI sedikit pun**.
 *
 * Ini fitur hemat kuota paling berharga di sistem: mengganti warna merek atau
 * memperbaiki satu judul tidak lagi menuntut generate ulang dari nol.
 */
import { useCallback, useState } from 'react';
import { getContent, getRawImage, uploadRendered } from '@/api';
import { renderAll, stripDataUrl, type RenderedImage } from '@/renderer';
import { specFromDetail } from './specFromDetail';
import type { Brand } from '@/types/brand';
import type { Format } from '@/types/content';

export interface RerenderState {
  running: boolean;
  note: string;
  images: RenderedImage[];
  error: Error | null;
}

export function useRerender(brand: Brand) {
  const [state, setState] = useState<RerenderState>({
    running: false,
    note: '',
    images: [],
    error: null,
  });

  const run = useCallback(
    async (contentId: string, pillarName?: string) => {
      setState({ running: true, note: 'Memuat data konten…', images: [], error: null });

      try {
        const detail = await getContent(contentId);
        const format = detail.content.format as Format;
        const spec = specFromDetail(detail);

        // Ambil gambar mentah — tidak menyentuh provider AI sama sekali.
        setState((s) => ({ ...s, note: 'Mengambil gambar tersimpan…' }));
        const raw = await getRawImage(contentId, 1);

        if (!raw.dataUrl) {
          setState((s) => ({
            ...s,
            note: 'Tidak ada gambar mentah tersimpan — dipakai latar tipografi.',
          }));
        }

        setState((s) => ({ ...s, note: 'Merender ulang…' }));
        const images = await renderAll({
          format,
          brand,
          spec,
          images: { cover: raw.dataUrl },
          ...(pillarName ? { pillarName } : {}),
          onProgress: (done, total) =>
            setState((s) => ({ ...s, note: `Merender ${done}/${total} halaman…` })),
        });

        setState((s) => ({ ...s, note: 'Menyimpan ke Drive…' }));
        for (const img of images) {
          await uploadRendered({
            contentId,
            format,
            index: img.index,
            base64: stripDataUrl(img.dataUrl),
          });
        }

        setState({
          running: false,
          note: `${images.length} halaman dirender ulang tanpa memakai kuota AI.`,
          images,
          error: null,
        });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setState({ running: false, note: '', images: [], error: err });
      }
    },
    [brand],
  );

  return { ...state, run };
}
