/**
 * Tab Pengaturan — inisialisasi database, tes provider, identitas merek.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  initDatabase,
  resetBreakers,
  saveSettings,
  shareAllImages,
  testProviders,
  toBrand,
} from '@/api';
import { BOOTSTRAP_KEY, useBootstrap } from '@/hooks/useBootstrap';
import { CONTENT_ALL } from '@/hooks/queryKeys';
import { useToast } from '@/hooks/useToast';
import { resetFonts } from '@/renderer';
import { Button, Card, ErrorBox, Field, Spinner, StateBadge, TextInput } from '@/components/ui';
import { LogoField } from './LogoField';
import type { Brand } from '@/types/brand';
import type { ProviderTestResult } from '@/types/api';

interface Props {
  /** Panel bank hashtag, dirakit di App supaya fitur tidak saling mengimpor. */
  hashtagSlot?: ReactNode;
}

export function SettingsPage({ hashtagSlot }: Props) {
  const { data, isPending, error, refetch } = useBootstrap();
  const qc = useQueryClient();
  const toast = useToast();

  const [brand, setBrand] = useState<Brand>({});
  const [tests, setTests] = useState<ProviderTestResult | null>(null);

  /**
   * Penyetelan dari sheet CONFIG yang layak diubah tanpa membuka spreadsheet.
   *
   * Hanya yang benar-benar sering disetel yang muncul di sini; sisanya tetap
   * di spreadsheet supaya halaman ini tidak berubah jadi editor basis data.
   */
  const [hashtagCount, setHashtagCount] = useState('');

  // Isi form begitu data merek tersedia.
  useEffect(() => {
    if (data) {
      setBrand(toBrand(data.brand));
      setHashtagCount(String(data.config['hashtag_count'] ?? ''));
    }
  }, [data]);

  const init = useMutation({
    mutationFn: initDatabase,
    onSuccess: (r) => {
      toast.show(r.message, 'ok');
      void qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY });
    },
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  const save = useMutation({
    mutationFn: () => {
      // Angka di luar akal sehat ditolak di sini, bukan dibiarkan sampai ke
      // prompt AI: hashtag_count 500 akan membuat caption jadi dinding tagar.
      const n = Number(hashtagCount);
      const config =
        Number.isFinite(n) && n >= 0 && n <= 30
          ? { hashtag_count: String(Math.round(n)) }
          : {};

      return saveSettings({ brand, config });
    },
    onSuccess: () => {
      // Font merek mungkin berubah — paksa muat ulang saat render berikutnya.
      resetFonts();
      toast.show('Pengaturan tersimpan.', 'ok');
      void qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY });
    },
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  const test = useMutation({
    mutationFn: (kind: 'text' | 'image') => testProviders(kind),
    onSuccess: setTests,
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  const unblock = useMutation({
    mutationFn: resetBreakers,
    onSuccess: (r) => {
      toast.show(r.message, 'ok');
      void qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY });
    },
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  const share = useMutation({
    mutationFn: shareAllImages,
    onSuccess: (r) => {
      toast.show(r.message, 'ok');
      // Berbagi ulang menyentuh gambar SELURUH konten, jadi ini salah satu dari
      // sedikit hal yang memang harus membatalkan daftar dan semua detail.
      CONTENT_ALL.forEach(function (key) {
        void qc.invalidateQueries({ queryKey: key });
      });
    },
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  if (isPending) return <Spinner label="Memuat pengaturan…" />;
  if (error) return <ErrorBox error={error} onRetry={() => void refetch()} />;

  const set = (k: keyof Brand) => (v: string) => setBrand((b) => ({ ...b, [k]: v }));

  return (
    <div className="stack">
      {data && !data.initialized && (
        <Card
          title="Database belum siap"
          desc={`Tab yang belum ada: ${data.missingTabs.join(', ')}`}
        >
          <Button
            label={init.isPending ? 'Membuat…' : 'Inisialisasi Database'}
            onClick={() => init.mutate()}
            disabled={init.isPending}
          />
        </Card>
      )}

      <Card
        title="Tes provider"
        desc="Menguji koneksi satu per satu. Tes gambar memakai kuota nyata satu panggilan per provider."
      >
        <div className="row-btn">
          <Button
            label="Tes provider teks"
            onClick={() => test.mutate('text')}
            disabled={test.isPending}
          />
          <Button
            label="Tes provider gambar"
            onClick={() => test.mutate('image')}
            disabled={test.isPending}
          />
          <Button
            label="Bebaskan circuit breaker"
            onClick={() => unblock.mutate()}
            disabled={unblock.isPending}
          />
        </div>

        {test.isPending && <Spinner label="Menguji… bisa sampai beberapa menit." />}
        {tests && <TestTable result={tests} />}
      </Card>

      <Card title="Kuota hari ini" desc="Reset otomatis tengah malam (Asia/Jakarta).">
        <div className="chips">
          {data?.providers.map((p) => (
            <StateBadge key={`${p.provider}-${p.kind}`} state={p.state}>
              {p.provider} · {p.kind} · {p.calls}
              {p.cap > 0 ? `/${p.cap}` : ''}
            </StateBadge>
          ))}
        </div>
      </Card>

      {hashtagSlot}

      <Card
        title="Perbaiki pratinjau gambar"
        desc="Kalau ada gambar di Library yang tidak tampil, berkasnya kemungkinan belum dibagikan. Tombol ini membagikan ulang semuanya."
      >
        <Button
          label={share.isPending ? 'Memproses…' : 'Bagikan ulang semua gambar'}
          onClick={() => share.mutate()}
          disabled={share.isPending}
        />
      </Card>

      <Card
        title="Identitas merek"
        desc="Dipakai untuk warna, font, dan nada bicara di seluruh konten."
      >
        <div className="grid2">
          <Field label="Nama merek">
            <TextInput
              value={brand.brandName ?? ''}
              onChange={(v) => set('brandName')(v)}
            />
          </Field>
          <Field label="Handle Instagram">
            <TextInput
              value={brand.igHandle ?? ''}
              onChange={(v) => set('igHandle')(v)}
              placeholder="@nama.akun"
            />
          </Field>
          <Field label="Website">
            <TextInput
              value={brand.website ?? ''}
              onChange={(v) => set('website')(v)}
            />
          </Field>
          <Field label="Tagline">
            <TextInput
              value={brand.tagline ?? ''}
              onChange={(v) => set('tagline')(v)}
            />
          </Field>

          {/* Berpasangan dengan handle Instagram: keduanya tanda merek yang
              muncul di kaki halaman, dan logo menggantikan teksnya. */}
          <LogoField hasLogo={Boolean(brand.logoDriveId)} />

          <ColorField
            label="Warna utama"
            value={brand.primaryColor ?? '#C9A961'}
            onChange={set('primaryColor')}
          />
          <ColorField
            label="Warna sekunder"
            value={brand.secondaryColor ?? '#2E3A45'}
            onChange={set('secondaryColor')}
          />
          <ColorField
            label="Warna latar"
            value={brand.bgColor ?? '#FAF7F2'}
            onChange={set('bgColor')}
          />

          <Field label="Font judul" tip="Ditulis persis seperti namanya di Google Fonts.">
            <TextInput
              value={brand.fontHeading ?? ''}
              onChange={(v) => set('fontHeading')(v)}
              placeholder="Playfair Display"
            />
          </Field>
          <Field label="Font isi" tip="Ditulis persis seperti namanya di Google Fonts.">
            <TextInput
              value={brand.fontBody ?? ''}
              onChange={(v) => set('fontBody')(v)}
              placeholder="Inter"
            />
          </Field>
        </div>

        <Field label="Nada bicara">
          <TextInput value={brand.tone ?? ''} onChange={(v) => set('tone')(v)} />
        </Field>
        <Field label="Target pembaca">
          <TextInput
            value={brand.audience ?? ''}
            onChange={(v) => set('audience')(v)}
          />
        </Field>
        <Field
          label="Kata terlarang"
          hint="Dipisah koma. Dibersihkan otomatis dari caption."
        >
          <TextInput
            value={brand.forbiddenWords ?? ''}
            onChange={(v) => set('forbiddenWords')(v)}
          />
        </Field>

        <Field
          label="Jumlah hashtag per caption"
          hint="3–5 disarankan. Instagram kini mengindeks kata di caption untuk pencarian, sementara tumpukan tagar justru terlihat seperti spam."
        >
          <TextInput
            type="number"
            min={0}
            max={30}
            value={hashtagCount}
            onChange={setHashtagCount}
          />
        </Field>

        <Button
          label={save.isPending ? 'Menyimpan…' : 'Simpan pengaturan'}
          onClick={() => save.mutate()}
          disabled={save.isPending}
        />
      </Card>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="color-row">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
        <TextInput value={value} onChange={(v) => onChange(v)} />
      </div>
    </Field>
  );
}

function TestTable({ result }: { result: ProviderTestResult }) {
  const rows = [result.drive, ...result.text, ...result.image].filter(
    (r) => r.provider,
  );

  return (
    // Dibungkus supaya tabel digulir mendatar di dalam wadahnya sendiri saat
    // layar sempit, bukan menggeser seluruh halaman.
    <div className="table">
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Hasil</th>
            <th>Keterangan</th>
            <th className="num">ms</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.provider}-${i}`}>
              <td>{r.provider}</td>
              <td className={r.ok ? 'ok' : 'bad'}>{r.ok ? '✓' : '✕'}</td>
              <td className="msg-cell">{r.message}</td>
              <td className="num">{r.ms || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
