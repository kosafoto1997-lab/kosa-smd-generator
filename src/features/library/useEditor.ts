/**
 * useEditor.ts — Sunting teks dan tampilan satu konten, lalu render ulang.
 *
 * Dua hal yang bisa diubah di sini: **teks tiap halaman** dan **penyetelan
 * visual** (posisi, ukuran, ketebalan lapisan gelap). Keduanya digabung
 * karena orang jarang mengubah salah satunya saja — judul dipendekkan lalu
 * ukurannya dinaikkan, begitu seterusnya.
 *
 * Pratinjau digambar di browser tanpa menyentuh AI maupun Drive. Penyimpanan
 * baru terjadi saat tombol simpan ditekan, sehingga bereksperimen sama sekali
 * tidak berbiaya.
 */
import { useCallback, useState } from 'react';
import { getRawImage, saveDesign, updateSlideText, uploadRendered } from '@/api';
import { renderAll, stripDataUrl, type RenderedImage } from '@/renderer';
import { specFromDetail } from './specFromDetail';
import { withDrafts, type SlideDraft } from './withDrafts';
import type { Brand } from '@/types/brand';
import type { ContentDetail } from '@/types/api';
import type { Format } from '@/types/content';
import type { DesignOverrides } from '@/types/design';

export type { SlideDraft } from './withDrafts';

export interface EditorState {
  busy: boolean;
  note: string;
  previews: RenderedImage[];
  error: Error | null;
}

export function useEditor(brand: Brand) {
  const [state, setState] = useState<EditorState>({
    busy: false,
    note: '',
    previews: [],
    error: null,
  });

  /**
   * Gambar ulang di browser saja — tidak menyimpan apa pun.
   *
   * Dipanggil setiap kali pengguna menekan "Lihat hasil", bukan pada setiap
   * ketikan: satu carousel tujuh halaman perlu waktu terlalu lama untuk
   * dijalankan di tiap penekanan tombol.
   */
  const preview = useCallback(
    async (
      detail: ContentDetail,
      drafts: SlideDraft[],
      design: DesignOverrides,
      pillarName?: string,
    ) => {
      setState({ busy: true, note: 'Mengambil gambar tersimpan…', previews: [], error: null });

      try {
        const format = detail.content.format as Format;
        const spec = withDrafts(specFromDetail(detail), drafts);
        const raw = await getRawImage(detail.content.contentId, 1);

        setState((s) => ({ ...s, note: 'Menggambar pratinjau…' }));
        const previews = await renderAll({
          format,
          brand,
          spec,
          images: { cover: raw.dataUrl },
          ...(pillarName ? { pillarName } : {}),
          design,
          onProgress: (done, total) =>
            setState((s) => ({ ...s, note: `Menggambar ${done}/${total} halaman…` })),
        });

        setState({ busy: false, note: '', previews, error: null });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setState({ busy: false, note: '', previews: [], error: err });
      }
    },
    [brand],
  );

  /**
   * Simpan hasil suntingan: teks ke spreadsheet, gambar ke Drive.
   *
   * Menggambar ulang dari awal alih-alih memakai hasil pratinjau, supaya
   * yang tersimpan pasti cocok dengan teks dan penyetelan terbaru walaupun
   * pratinjaunya sudah usang.
   */
  const save = useCallback(
    async (
      detail: ContentDetail,
      drafts: SlideDraft[],
      design: DesignOverrides,
      pillarName?: string,
    ) => {
      const contentId = detail.content.contentId;
      setState((s) => ({ ...s, busy: true, note: 'Menggambar versi akhir…', error: null }));

      try {
        const format = detail.content.format as Format;
        const spec = withDrafts(specFromDetail(detail), drafts);
        const raw = await getRawImage(contentId, 1);

        const images = await renderAll({
          format,
          brand,
          spec,
          images: { cover: raw.dataUrl },
          ...(pillarName ? { pillarName } : {}),
          design,
          onProgress: (done, total) =>
            setState((s) => ({ ...s, note: `Menggambar ${done}/${total} halaman…` })),
        });

        setState((s) => ({ ...s, note: 'Menyimpan teks…' }));
        for (const d of drafts) {
          await updateSlideText(contentId, d.order, d.title, d.body);
        }

        setState((s) => ({ ...s, note: 'Mengunggah gambar…' }));
        for (const img of images) {
          await uploadRendered({
            contentId,
            format,
            index: img.index,
            base64: stripDataUrl(img.dataUrl),
          });
        }

        // Disimpan terakhir supaya penyetelan yang tercatat selalu merupakan
        // penyetelan yang benar-benar dipakai menggambar gambar tersimpan.
        await saveDesign(contentId, design);

        setState({
          busy: false,
          note: `${images.length} halaman tersimpan. Tidak ada kuota AI yang terpakai.`,
          previews: images,
          error: null,
        });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setState((s) => ({ ...s, busy: false, note: '', error: err }));
      }
    },
    [brand],
  );

  const reset = useCallback(() => {
    setState({ busy: false, note: '', previews: [], error: null });
  }, []);

  return { ...state, preview, save, reset };
}
