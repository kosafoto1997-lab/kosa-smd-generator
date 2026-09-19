/**
 * useCanvasDoc.ts — Dokumen kanvas beserta riwayat undo/redo.
 *
 * Riwayat disimpan sebagai salinan utuh dokumen, bukan selisih perubahan.
 * Sebuah desain berisi puluhan elemen, bukan ribuan, jadi satu salinan hanya
 * beberapa kilobyte — dan patch yang bisa dibalik jauh lebih mudah ditulis
 * salah. Satu bug di situ membuat undo menghasilkan dokumen yang tidak pernah
 * benar-benar ada.
 *
 * Yang tidak boleh masuk riwayat: seleksi. Menekan undo setelah mengklik
 * elemen lain harus membatalkan perubahan terakhir, bukan mengembalikan
 * seleksi — kalau tidak, user menekan undo dua kali untuk satu pembatalan.
 */
import { useCallback, useRef, useState } from 'react';
import type { CanvasDoc, CanvasElement, PresetId } from '@/types/canvas';
import { CANVAS_PRESETS, emptyDoc } from '@/types/canvas';

/** Batas riwayat. Cukup dalam untuk rasa aman, cukup dangkal untuk memori. */
const HISTORY_LIMIT = 60;

export interface CanvasDocApi {
  doc: CanvasDoc;
  selectedIds: string[];
  canUndo: boolean;
  canRedo: boolean;

  select: (ids: string[]) => void;
  add: (el: CanvasElement) => void;
  /** Ubah satu elemen. `commit: false` untuk perubahan saat menyeret. */
  patch: (id: string, changes: Partial<CanvasElement>, commit?: boolean) => void;
  remove: (ids: string[]) => void;
  duplicate: (ids: string[]) => void;
  reorder: (id: string, to: number) => void;
  setBackground: (color: string) => void;
  setPreset: (preset: PresetId) => void;
  replaceDoc: (next: CanvasDoc) => void;

  /** Tutup satu rangkaian seret jadi satu langkah undo. */
  commit: () => void;
  undo: () => void;
  redo: () => void;
}

export function useCanvasDoc(initial?: CanvasDoc): CanvasDocApi {
  const [doc, setDoc] = useState<CanvasDoc>(initial ?? emptyDoc());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const past = useRef<CanvasDoc[]>([]);
  const future = useRef<CanvasDoc[]>([]);

  /*
    Dokumen sebelum rangkaian seret dimulai.

    Saat user menyeret, `patch` dipanggil puluhan kali per detik. Kalau tiap
    panggilan masuk riwayat, satu seretan menghabiskan seluruh riwayat dan undo
    hanya bergerak sepersekian piksel. Jadi yang disimpan adalah keadaan
    SEBELUM seretan, sekali saja, lalu di-commit saat pointer dilepas.
  */
  const dragBase = useRef<CanvasDoc | null>(null);

  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  /** Dorong satu keadaan ke riwayat dan buang masa depan. */
  const push = useCallback((snapshot: CanvasDoc) => {
    past.current.push(snapshot);
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
    bump();
  }, []);

  /** Ubah dokumen sambil mencatat riwayat. */
  const mutate = useCallback(
    (fn: (d: CanvasDoc) => CanvasDoc, commitNow = true) => {
      setDoc((prev) => {
        if (commitNow) {
          push(prev);
        } else if (!dragBase.current) {
          // Seretan baru dimulai: ingat titik awalnya, belum dicatat.
          dragBase.current = prev;
        }
        return fn(prev);
      });
    },
    [push],
  );

  const commit = useCallback(() => {
    if (!dragBase.current) return;
    push(dragBase.current);
    dragBase.current = null;
  }, [push]);

  const add = useCallback(
    (el: CanvasElement) => {
      mutate((d) => ({ ...d, elements: [...d.elements, el] }));
      setSelectedIds([el.id]);
    },
    [mutate],
  );

  const patch = useCallback(
    (id: string, changes: Partial<CanvasElement>, commitNow = true) => {
      mutate(
        (d) => ({
          ...d,
          elements: d.elements.map((e) =>
            // `as CanvasElement` perlu karena TypeScript tidak bisa membuktikan
            // Partial<CanvasElement> cocok dengan varian yang sedang dipegang.
            e.id === id ? ({ ...e, ...changes } as CanvasElement) : e,
          ),
        }),
        commitNow,
      );
    },
    [mutate],
  );

  const remove = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      mutate((d) => ({ ...d, elements: d.elements.filter((e) => !ids.includes(e.id)) }));
      setSelectedIds([]);
    },
    [mutate],
  );

  const duplicate = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const fresh: string[] = [];
      mutate((d) => {
        const copies = d.elements
          .filter((e) => ids.includes(e.id))
          .map((e) => {
            // Digeser sedikit supaya salinan terlihat, bukan tersembunyi
            // tepat di belakang aslinya.
            const id = `${e.id}c${Math.random().toString(36).slice(2, 6)}`;
            fresh.push(id);
            return { ...e, id, x: e.x + 24, y: e.y + 24 };
          });
        return { ...d, elements: [...d.elements, ...copies] };
      });
      setSelectedIds(fresh);
    },
    [mutate],
  );

  /** Pindahkan elemen ke posisi tumpukan tertentu. */
  const reorder = useCallback(
    (id: string, to: number) => {
      mutate((d) => {
        const from = d.elements.findIndex((e) => e.id === id);
        if (from === -1) return d;
        const next = d.elements.slice();
        const [moved] = next.splice(from, 1);
        if (!moved) return d;
        next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
        return { ...d, elements: next };
      });
    },
    [mutate],
  );

  const setBackground = useCallback(
    (color: string) => mutate((d) => ({ ...d, background: color })),
    [mutate],
  );

  /**
   * Ganti ukuran kanvas, sambil memindahkan elemen secara proporsional.
   *
   * Tanpa penskalaan, berpindah dari 4:5 ke 9:16 membuat setengah desain
   * berada di luar kanvas — terlihat seperti pekerjaannya hilang.
   */
  const setPreset = useCallback(
    (preset: PresetId) => {
      mutate((d) => {
        const from = CANVAS_PRESETS[d.preset];
        const to = CANVAS_PRESETS[preset];
        if (from.w === to.w && from.h === to.h) return { ...d, preset };

        const sx = to.w / from.w;
        const sy = to.h / from.h;
        // Satu faktor untuk ukuran, supaya lingkaran tidak berubah jadi lonjong.
        const s = Math.min(sx, sy);

        return {
          ...d,
          preset,
          elements: d.elements.map((e) => ({
            ...e,
            x: Math.round(e.x * sx),
            y: Math.round(e.y * sy),
            width: Math.round(e.width * s),
            height: Math.round(e.height * s),
            ...(e.type === 'text' ? { fontSize: Math.round(e.fontSize * s) } : {}),
          })),
        };
      });
    },
    [mutate],
  );

  const replaceDoc = useCallback(
    (next: CanvasDoc) => {
      mutate(() => next);
      setSelectedIds([]);
    },
    [mutate],
  );

  const undo = useCallback(() => {
    setDoc((prev) => {
      const last = past.current.pop();
      if (!last) return prev;
      future.current.push(prev);
      bump();
      return last;
    });
    setSelectedIds([]);
  }, []);

  const redo = useCallback(() => {
    setDoc((prev) => {
      const next = future.current.pop();
      if (!next) return prev;
      past.current.push(prev);
      bump();
      return next;
    });
    setSelectedIds([]);
  }, []);

  // `version` dibaca di sini supaya React menghitung ulang canUndo/canRedo
  // setiap riwayat berubah — ref sendiri tidak memicu render.
  void version;

  return {
    doc,
    selectedIds,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    select: setSelectedIds,
    add,
    patch,
    remove,
    duplicate,
    reorder,
    setBackground,
    setPreset,
    replaceDoc,
    commit,
    undo,
    redo,
  };
}
