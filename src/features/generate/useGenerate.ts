/**
 * useGenerate.ts — Pembuatan satu konten, lengkap dengan tampilan langkahnya.
 *
 * Alur produksinya sendiri ada di `produce.ts` dan dipakai bersama pembuatan
 * massal. Berkas ini hanya menerjemahkan kemajuan itu menjadi keadaan React
 * yang bisa digambar UI.
 */
import { useCallback, useState } from 'react';
import { produceOne, type ProduceArgs, type ProduceResult } from './produce';
import type { Brand } from '@/types/brand';

export type StepState = 'idle' | 'active' | 'done' | 'fail';

export interface Step {
  label: string;
  state: StepState;
  note?: string;
}

export type GenerateArgs = ProduceArgs;
export type GenerateResult = ProduceResult;

const STEP_LABELS = [
  'Menyusun naskah & caption',
  'Mengambil gambar',
  'Merender halaman',
  'Menyimpan ke Drive & spreadsheet',
];

export function useGenerate(brand: Brand, pillarName: (id: string) => string) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [running, setRunning] = useState(false);

  const mark = useCallback((i: number, state: StepState, note?: string) => {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, state, ...(note ? { note } : {}) } : s)),
    );
  }, []);

  const run = useCallback(
    async (args: GenerateArgs) => {
      setRunning(true);
      setResult(null);
      setError(null);
      setSteps(
        STEP_LABELS.map((label, i) => ({
          label: i === 1 && args.skipImage ? 'Melewati AI gambar' : label,
          state: 'idle',
        })),
      );

      try {
        const out = await produceOne(args, brand, pillarName, (step, note, done) => {
          mark(step, done ? 'done' : 'active', note);
        });

        setResult(out);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);

        // Tandai langkah yang sedang berjalan sebagai gagal, beserta sebabnya.
        // Kegagalan yang tidak terlihat jauh lebih buruk daripada kegagalan
        // yang jelas — itu keluhan terbesar pada tool sejenis.
        setSteps((prev) => {
          const i = prev.findIndex((s) => s.state === 'active');
          if (i === -1) return prev;
          return prev.map((s, idx) =>
            idx === i ? { ...s, state: 'fail', note: err.message } : s,
          );
        });
      } finally {
        setRunning(false);
      }
    },
    [brand, mark, pillarName],
  );

  return { steps, result, error, running, run };
}
