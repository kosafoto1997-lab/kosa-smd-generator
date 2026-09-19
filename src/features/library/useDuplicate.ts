/**
 * useDuplicate.ts — Gandakan konten yang sudah ada.
 *
 * Kegunaan nyata: ambil konten yang performanya bagus, ubah sedikit
 * topik atau captionnya, terbitkan lagi. Tanpa ini setiap konten harus
 * dimulai dari nol.
 *
 * Tidak memanggil AI sama sekali — gambar diambil dari 99_Raw_AI seperti
 * render ulang, lalu disimpan sebagai konten baru dengan id sendiri.
 */
import { useCallback, useState } from 'react';
import { fromSpec, getContent, getRawImage, saveContent, uploadRendered } from '@/api';
import { renderAll, stripDataUrl } from '@/renderer';
import { specFromDetail } from './specFromDetail';
import type { Brand } from '@/types/brand';
import type { Format } from '@/types/content';

export interface DuplicateState {
  running: boolean;
  note: string;
  newId: string | null;
  error: Error | null;
}

/**
 * Id konten baru.
 *
 * Pola "C" + waktu + acak mengikuti yang dipakai backend, sehingga urutannya
 * tetap masuk akal saat diurutkan.
 */
function newContentId(): string {
  const d = new Date();
  const stamp =
    String(d.getFullYear()).slice(2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `C${stamp}${rand}`;
}

export function useDuplicate(brand: Brand) {
  const [state, setState] = useState<DuplicateState>({
    running: false,
    note: '',
    newId: null,
    error: null,
  });

  const run = useCallback(
    async (sourceId: string, pillarName?: string) => {
      setState({ running: true, note: 'Memuat konten sumber…', newId: null, error: null });

      try {
        const detail = await getContent(sourceId);
        const format = detail.content.format as Format;
        const spec = specFromDetail(detail);
        const targetId = newContentId();

        setState((s) => ({ ...s, note: 'Mengambil gambar tersimpan…' }));
        const raw = await getRawImage(sourceId, 1);

        setState((s) => ({ ...s, note: 'Merender salinan…' }));
        const images = await renderAll({
          format,
          brand,
          spec,
          images: { cover: raw.dataUrl },
          ...(pillarName ? { pillarName } : {}),
          onProgress: (done, total) =>
            setState((s) => ({ ...s, note: `Merender ${done}/${total} halaman…` })),
        });

        setState((s) => ({ ...s, note: 'Menyimpan salinan…' }));
        const files: Array<{ index: number; fileId: string; url: string }> = [];

        for (const img of images) {
          const up = await uploadRendered({
            contentId: targetId,
            format,
            index: img.index,
            base64: stripDataUrl(img.dataUrl),
          });
          files.push({ index: img.index, fileId: up.fileId, url: up.url });
        }

        await saveContent({
          content_id: targetId,
          format,
          pillar: detail.content.pillar,
          spec: fromSpec(spec),
          image_provider: 'duplikat',
          text_provider: 'duplikat',
          files,
          notes: `Salinan dari ${sourceId}`,
        });

        setState({
          running: false,
          note: 'Salinan dibuat. Edit topik atau captionnya sebelum diposting.',
          newId: targetId,
          error: null,
        });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setState({ running: false, note: '', newId: null, error: err });
      }
    },
    [brand],
  );

  return { ...state, run };
}
