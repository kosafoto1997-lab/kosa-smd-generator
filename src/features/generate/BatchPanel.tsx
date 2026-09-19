/**
 * BatchPanel.tsx — Membuat stok konten sekali duduk.
 *
 * Ditaruh di tab yang sama dengan pembuatan satuan karena keduanya pekerjaan
 * yang sama, hanya beda jumlah — memisahkannya ke tab sendiri akan membuat
 * orang harus memilih sebelum tahu bedanya apa.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Field } from '@/components/ui';
import { CONTENT_LIST_KEY } from '@/hooks/queryKeys';
import { useBatch } from './useBatch';
import { describePlan, planBatch, type PillarWeight } from './planBatch';
import type { Brand } from '@/types/brand';
import type { Format } from '@/types/content';

/**
 * Pilihan jumlah yang masuk akal.
 *
 * Bukan kolom angka bebas: pilihan siap pakai membuat keputusannya seketika,
 * dan tiap angka di sini punya arti nyata dalam sebulan.
 */
const PRESETS = [
  { n: 4, label: '4', hint: 'seminggu' },
  { n: 8, label: '8', hint: 'dua minggu' },
  { n: 12, label: '12', hint: 'sebulan' },
  { n: 20, label: '20', hint: 'sebulan padat' },
];

export function BatchPanel({
  brand,
  pillars,
  pillarName,
  format,
  slides,
  skipImage,
  perFrame,
}: {
  brand: Brand;
  pillars: PillarWeight[];
  pillarName: (id: string) => string;
  /** Setelan diambil dari form di atasnya supaya tidak ada dua tempat mengatur hal sama. */
  format: Format;
  slides: number;
  skipImage: boolean;
  perFrame: boolean;
}) {
  const qc = useQueryClient();
  const batch = useBatch(brand, pillars, pillarName);
  const [count, setCount] = useState(12);

  const plan = planBatch(count, pillars);

  async function start() {
    await batch.run({ format, count, slides, skipImage, perFrame });
    // Semuanya konten baru, jadi tidak ada detail ter-cache yang ikut basi.
    void qc.invalidateQueries({ queryKey: CONTENT_LIST_KEY });
    void qc.invalidateQueries({ queryKey: ['bootstrap'] });
  }

  const finished = !batch.running && batch.items.length > 0;

  return (
    <>
      <Field
        label="Jumlah konten"
        hint="Topiknya dipilih otomatis dari bank ide, jadi kamu tidak perlu memikirkan satu per satu."
      >
        <div className="pills">
          {PRESETS.map((p) => (
            <Button
              key={p.n}
              kind={count === p.n ? 'primary' : 'secondary'}
              label={p.label}
              onClick={() => setCount(p.n)}
              disabled={batch.running}
              title={p.hint}
            />
          ))}
        </div>
      </Field>

      {plan.length > 0 && !batch.items.length && (
        <p className="notice">
          Komposisinya mengikuti bobot pilar: <strong>{describePlan(plan)}</strong>.
        </p>
      )}

      <div className="row-btn wrap">
        {!batch.running && (
          <Button
            kind="primary"
            label={finished ? 'Buat lagi' : `Buat ${count} konten`}
            onClick={() => void start()}
          />
        )}

        {batch.running && (
          <Button label="Hentikan setelah yang ini" onClick={batch.stop} />
        )}

        {finished && <Button label="Bersihkan daftar" onClick={batch.reset} />}
      </div>

      {batch.items.length > 0 && (
        <>
          <p className="dim small batch-count">
            {batch.running
              ? `Mengerjakan ${batch.current} dari ${batch.items.length}…`
              : `Selesai: ${batch.done} jadi${batch.failed ? `, ${batch.failed} gagal` : ''}.`}
          </p>

          <ol className="batch-list">
            {batch.items.map((it) => (
              <li key={it.seq} className={`batch-row batch-${it.state}`}>
                <span className="batch-seq">{it.seq}</span>
                <span className="batch-main">
                  <strong>{it.topic || it.pillarName}</strong>
                  {it.note && <span className="batch-note">{it.note}</span>}
                </span>
                <span className="batch-state">
                  {it.state === 'selesai'
                    ? '✓'
                    : it.state === 'gagal'
                      ? '✕'
                      : it.state === 'jalan'
                        ? '…'
                        : it.state === 'batal'
                          ? '–'
                          : '·'}
                </span>
              </li>
            ))}
          </ol>

          {batch.failed > 0 && !batch.running && (
            <p className="dim small">
              Konten yang gagal biasanya karena kuota AI harian habis. Coba lagi
              besok, atau centang <em>Lewati AI gambar</em> di opsi lanjutan —
              itu tidak memakai kuota sama sekali.
            </p>
          )}
        </>
      )}
    </>
  );
}
