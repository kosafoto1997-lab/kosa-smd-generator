/**
 * Tab Generate — membuat satu konten dari awal sampai tersimpan.
 */
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBootstrap, useBrand } from '@/hooks/useBootstrap';
import { CONTENT_LIST_KEY } from '@/hooks/queryKeys';
import { useToast } from '@/hooks/useToast';
import {
  Button,
  Card,
  CheckBox,
  ErrorBox,
  Field,
  Select,
  Spinner,
  TextArea,
  TextInput,
} from '@/components/ui';
import { useGenerate, type Step } from './useGenerate';
import { BatchPanel } from './BatchPanel';
import type { Format } from '@/types/content';
import type { ReactNode } from 'react';

/**
 * Story sengaja disebut "Story / Status WA".
 *
 * Status WhatsApp memakai rasio 9:16 yang sama persis, dan bagi reseller
 * undangan di Indonesia ia justru kanal promosi utama — WhatsApp adalah kanal
 * social commerce nomor dua di sini. Menyebutnya di label jauh lebih murah
 * daripada menambah format baru yang keluarannya identik.
 */
const FORMATS: Array<{ id: Format; label: string; ratio: string }> = [
  { id: 'carousel', label: 'Carousel', ratio: '4:5 · 5–8 halaman' },
  { id: 'feed', label: 'Feed', ratio: '4:5 · 1 gambar' },
  { id: 'story', label: 'Story / Status WA', ratio: '9:16 · 1 gambar' },
  { id: 'reels', label: 'Reels', ratio: '9:16 · 3–5 frame' },
  { id: 'shorts', label: 'Shorts', ratio: '9:16 · 3–5 frame' },
];

interface Props {
  /**
   * Panel bank ide, dirakit di App supaya fitur tidak saling mengimpor.
   * Menerima fungsi pengisi topik agar ide bisa langsung dipakai.
   */
  ideasSlot?: (fill: (topic: string, pillar: string) => void) => ReactNode;
}

export function GeneratePage({ ideasSlot }: Props) {
  const { data, isPending, error, refetch } = useBootstrap();
  const brand = useBrand();
  const toast = useToast();
  const qc = useQueryClient();

  const [mode, setMode] = useState<'satu' | 'banyak'>('satu');
  const [format, setFormat] = useState<Format>('carousel');
  const [pillar, setPillar] = useState('auto');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(7);
  const [skipImage, setSkipImage] = useState(false);
  const [perFrame, setPerFrame] = useState(false);

  const pillarName = useCallback(
    (id: string) => data?.pillars.find((p) => p.id === id)?.name ?? id,
    [data],
  );

  const gen = useGenerate(brand, pillarName);

  if (isPending) return <Spinner label="Memuat…" />;
  if (error) return <ErrorBox error={error} onRetry={() => void refetch()} />;

  if (data && !data.initialized) {
    return (
      <Card title="Database belum siap" desc="Buka tab Pengaturan untuk menginisialisasi.">
        <p className="dim">Tab yang belum ada: {data.missingTabs.join(', ')}</p>
      </Card>
    );
  }

  const isFrameFormat = format === 'reels' || format === 'shorts';
  const needsCount = isFrameFormat || format === 'carousel';

  async function onGenerate() {
    await gen.run({ format, pillar, topic: topic.trim(), count, skipImage, perFrame });
    // Konten baru belum pernah punya detail ter-cache, jadi daftarnya saja.
    void qc.invalidateQueries({ queryKey: CONTENT_LIST_KEY });
    void qc.invalidateQueries({ queryKey: ['bootstrap'] });
  }

  return (
    /*
      Dua kolom di layar lebar: form di kiri, proses dan hasil di kanan.
      Melihat hasil sambil menyetel form adalah satu pekerjaan — menaruhnya
      berurutan ke bawah memaksa menggulir bolak-balik di tiap percobaan.
    */
    <div className="gen">
      <Card
        title="Buat konten"
        desc={
          mode === 'satu'
            ? 'Satu konten sekali jalan. Prosesnya dipecah empat langkah agar tidak melewati batas waktu.'
            : 'Sekali duduk, langsung punya stok. Topik dipilih otomatis dari bank ide dan komposisinya mengikuti bobot pilar.'
        }
      >
        {/*
          Dua mode, satu form. Setelan format dan opsi lanjutan berlaku untuk
          keduanya, jadi memisahkannya ke tab berbeda hanya akan memaksa orang
          mengatur hal yang sama dua kali.
        */}
        <div className="mode-pick">
          <Button
            kind={mode === 'satu' ? 'primary' : 'secondary'}
            label="Satu konten"
            onClick={() => setMode('satu')}
            disabled={gen.running}
            full
          />
          <Button
            kind={mode === 'banyak' ? 'primary' : 'secondary'}
            label="Banyak sekaligus"
            onClick={() => setMode('banyak')}
            disabled={gen.running}
            full
          />
        </div>

        <Field label="Format">
          <div className="pills pills-grid">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`pill ${format === f.id ? 'pill-on' : ''}`}
                onClick={() => setFormat(f.id)}
                disabled={gen.running}
              >
                <strong>{f.label}</strong>
                <span>{f.ratio}</span>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid2">
          {/*
            Pilar hanya bisa dipilih untuk satu konten. Dalam mode banyak,
            pembagiannya ditentukan bobot — memilih satu pilar di sana justru
            membatalkan gunanya.
          */}
          {mode === 'satu' && (
            <Field label="Pilar">
              <Select
                value={pillar}
                onChange={(v) => setPillar(v)}
                options={[
                  { value: 'auto', label: 'Otomatis (sesuai bobot)' },
                  ...(data?.pillars ?? []).map((p) => ({
                    value: p.id,
                    label: `${p.name} · ${p.weight}%`,
                  })),
                ]}
                disabled={gen.running}
              />
            </Field>
          )}

          {needsCount && (
            <Field
              label={isFrameFormat ? 'Jumlah frame' : 'Jumlah halaman'}
              tip={isFrameFormat ? '3–5 frame disarankan.' : '5–8 halaman disarankan.'}
            >
              <TextInput
                type="number"
                min={isFrameFormat ? 3 : 2}
                max={isFrameFormat ? 10 : 8}
                value={String(count)}
                onChange={(v) => setCount(Number(v) || 1)}
                disabled={gen.running}
              />
            </Field>
          )}
        </div>

        {mode === 'satu' && (
        <Field label="Topik" hint="Kosongkan untuk membiarkan AI memilih dari bank ide.">
          <TextInput
            value={topic}
            onChange={(v) => setTopic(v)}
            placeholder="misal: kesalahan menulis nama di undangan"
            disabled={gen.running}
          />
        </Field>
        )}

        <details className="adv">
          <summary>Opsi lanjutan</summary>
          <CheckBox
            checked={skipImage}
            disabled={gen.running}
            onChange={setSkipImage}
            label="Lewati AI gambar, pakai latar tipografi"
            hint="Tidak memakai kuota. Sering lebih terbaca untuk konten edukasi."
          />

          {isFrameFormat && (
            <CheckBox
              checked={perFrame}
              disabled={gen.running || skipImage}
              onChange={setPerFrame}
              label="Gambar berbeda tiap frame"
              hint="Memakai kuota sebanyak jumlah frame."
            />
          )}
        </details>

        {mode === 'satu' ? (
          <Button
            kind="primary"
            label={gen.running ? 'Sedang membuat…' : 'Generate'}
            onClick={() => void onGenerate()}
            disabled={gen.running}
          />
        ) : (
          <BatchPanel
            brand={brand}
            pillars={data?.pillars ?? []}
            pillarName={pillarName}
            format={format}
            slides={count}
            skipImage={skipImage}
            perFrame={perFrame}
          />
        )}
      </Card>

      {/* Kolom kanan: bank ide, proses, dan hasil. */}
      <section className="gen-side">
      {/* Bank ide hanya berguna untuk satu konten; mode banyak memilih sendiri. */}
      {mode === 'satu' &&
        ideasSlot?.((t, p) => {
          setTopic(t);
          setPillar(p);
        })}

      {gen.steps.length > 0 && (
        <Card title="Proses">
          <ol className="steps">
            {gen.steps.map((s, i) => (
              <StepRow key={i} step={s} />
            ))}
          </ol>
          {gen.error && <ErrorBox error={gen.error} />}
        </Card>
      )}

      {gen.result && (
        <Card
          title="Hasil"
          desc={`${gen.result.images.length} gambar · teks: ${gen.result.textProvider} · gambar: ${gen.result.imageProvider}`}
        >
          {gen.result.sanitized.length > 0 && (
            <p className="notice">
              Aturan soft-selling bekerja: {gen.result.sanitized.length} kata
              terlarang dibersihkan otomatis —{' '}
              <em>{gen.result.sanitized.join(', ')}</em>
            </p>
          )}

          <div className="thumbs">
            {gen.result.images.map((img) => (
              <figure key={img.index}>
                <img src={img.dataUrl} alt={img.label} loading="lazy" />
                <figcaption>{img.label}</figcaption>
              </figure>
            ))}
          </div>

          <Field label="Caption">
            <TextArea
              rows={8}
              value={`${gen.result.spec.caption}\n\n${gen.result.spec.hashtags
                .map((h) => `#${h}`)
                .join(' ')}`}
              // Hanya untuk dibaca dan disalin.
              readOnly
              onChange={() => {}}
            />
          </Field>

          <Button
            label="Salin caption"
            onClick={() => {
              const text = `${gen.result?.spec.caption ?? ''}\n\n${(
                gen.result?.spec.hashtags ?? []
              )
                .map((h) => `#${h}`)
                .join(' ')}`;
              void navigator.clipboard
                .writeText(text)
                .then(() => toast.show('Caption disalin.', 'ok'))
                .catch(() => toast.show('Gagal menyalin caption.', 'error'));
            }}
          />
        </Card>
      )}
      </section>
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  const mark =
    step.state === 'done'
      ? '✓'
      : step.state === 'fail'
        ? '✕'
        : step.state === 'active'
          ? '…'
          : '·';

  return (
    <li className={`step step-${step.state}`}>
      <span className="step-mark">{mark}</span>
      <span className="step-label">{step.label}</span>
      {step.note && <span className="step-note">{step.note}</span>}
    </li>
  );
}
