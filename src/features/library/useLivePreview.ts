/**
 * useLivePreview.ts — Pratinjau yang menggambar ulang sendiri saat disetel.
 *
 * Menggantikan alur lama "ubah setelan → tekan Lihat hasil → tunggu". Yang
 * dulu membuatnya lambat bukan biaya menggambar, melainkan pekerjaan yang
 * ikut terseret ke dalam setiap pratinjau:
 *
 * - `getRawImage()` dipanggil ulang tiap kali — panggilan jaringan ke Apps
 *   Script di tengah jalur gambar. Di sini ia dipanggil **sekali** per konten.
 * - Seluruh halaman digambar, padahal yang terlihat cuma satu.
 * - Tiap halaman diekspor `toDataURL` jadi JPEG, padahal canvas-nya sendiri
 *   sudah tampil di layar.
 *
 * Sisanya soal penjadwalan: perubahan digabung ke satu gambar per frame lewat
 * `createScheduler`, sehingga menarik slider tidak menumpuk render basi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRawImage } from '@/api';
import {
  createScheduler,
  drawPage,
  ensureFonts,
  loadImage,
  type LiveJob,
} from '@/renderer';
import { brandWithDesign, type DesignOverrides } from '@/types/design';
import type { Brand } from '@/types/brand';
import type { ContentSpec } from '@/types/content';

/**
 * Skala piksel selama setelan masih digerakkan.
 *
 * Seperempat piksel cukup untuk menilai tata letak, dan mata tidak sempat
 * menangkap kelembutannya selama slider bergerak. Begitu berhenti, gambar
 * diulang pada resolusi penuh.
 */
const DRAFT_SCALE = 0.5;

/** Jeda diam sebelum digambar ulang pada resolusi penuh. */
const SETTLE_MS = 180;

export interface LivePreviewInput {
  spec: ContentSpec;
  design: DesignOverrides;
  pageIndex: number;
  pillarName?: string;
}

export function useLivePreview(brand: Brand, contentId: string, format: LiveJob['format']) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Permintaan terakhir disimpan supaya bisa digambar ulang saat font selesai
  // dimuat atau saat interaksi berhenti, tanpa menunggu perubahan berikutnya.
  const lastInput = useRef<LivePreviewInput | null>(null);
  const settleTimer = useRef<number | null>(null);

  /**
   * Ambil gambar mentah sekali per konten.
   *
   * Inilah satu-satunya sentuhan jaringan di seluruh hook. Kegagalannya tidak
   * fatal: `drawPage` menggambar latar prosedural kalau gambarnya null.
   */
  useEffect(() => {
    let alive = true;
    setReady(false);
    setError(null);

    (async () => {
      try {
        const raw = await getRawImage(contentId, 1);
        const img = await loadImage(raw.dataUrl);
        if (!alive) return;
        imageRef.current = img;
      } catch (e) {
        if (!alive) return;
        // Gambar tersimpan hilang bukan alasan melumpuhkan penyuntingan —
        // teks dan tata letaknya tetap bisa diatur di atas latar prosedural.
        imageRef.current = null;
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [contentId]);

  /**
   * Merek disalin ke ref, bukan dijadikan dependensi.
   *
   * `useBrand()` menyusun objek baru di tiap render, jadi memakainya sebagai
   * dependensi akan membuat penjadwal dibuat ulang terus-menerus — dan karena
   * `redraw` ikut berubah, efek yang memanggilnya akan menggambar tanpa henti.
   */
  const brandRef = useRef(brand);
  brandRef.current = brand;

  const scheduler = useMemo(
    () =>
      createScheduler<{ input: LivePreviewInput; scale: number }>(({ input, scale }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        drawPage(
          canvas,
          {
            format,
            brand: brandRef.current,
            spec: input.spec,
            image: imageRef.current,
            pageIndex: input.pageIndex,
            ...(input.pillarName ? { pillarName: input.pillarName } : {}),
            design: input.design,
          },
          scale,
        );
      }),
    [format],
  );

  // Frame yang tertunda harus dibatalkan saat panel ditutup; menggambar ke
  // canvas yang sudah dilepas React akan melempar.
  useEffect(
    () => () => {
      scheduler.cancel();
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    },
    [scheduler],
  );

  /**
   * Minta gambar ulang.
   *
   * `draft` dipakai saat setelan masih digerakkan: gambar pada seperempat
   * piksel, lalu jadwalkan pengulangan resolusi penuh setelah diam.
   */
  const redraw = useCallback(
    (input: LivePreviewInput, draft = false) => {
      if (!ready) return;
      lastInput.current = input;

      scheduler.request({ input, scale: draft ? DRAFT_SCALE : 1 });

      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      if (draft) {
        settleTimer.current = window.setTimeout(() => {
          const latest = lastInput.current;
          if (latest) scheduler.request({ input: latest, scale: 1 });
        }, SETTLE_MS);
      }

      // Canvas tidak pernah menggambar ulang dirinya sendiri ketika font
      // akhirnya selesai diunduh, jadi gambar ulang secara eksplisit. Frame
      // pertama memakai fallback — itu disengaja, lebih baik daripada kosong.
      //
      // Gambar ulang hanya kalau permintaan ini masih yang terbaru; tanpa
      // penjagaan itu, font yang selesai belakangan bisa mengembalikan
      // pratinjau ke setelan lama.
      void ensureFonts(brandWithDesign(brandRef.current, input.design)).then(() => {
        if (lastInput.current === input) {
          scheduler.request({ input, scale: draft ? DRAFT_SCALE : 1 });
        }
      });
    },
    [ready, scheduler],
  );

  return { canvasRef, redraw, ready, error };
}
