/**
 * Bank ide — backlog topik yang bisa dipakai saat generate.
 *
 * AI menghasilkan ide dalam jumlah banyak sekali jalan, jauh lebih hemat
 * daripada memikirkan topik satu per satu setiap kali mau membuat konten.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateIdeas, listIdeas } from '@/api';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useToast } from '@/hooks/useToast';
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Select,
  Spinner,
  TextInput,
} from '@/components/ui';

export const IDEAS_KEY = ['ideas'] as const;

export function IdeasPanel({
  onPick,
}: {
  /** Dipanggil saat pengguna memilih satu ide untuk dijadikan konten. */
  onPick?: (topic: string, pillar: string) => void;
}) {
  const { data: boot } = useBootstrap();
  const qc = useQueryClient();
  const toast = useToast();

  const [pillar, setPillar] = useState('auto');
  const [count, setCount] = useState(5);

  const ideas = useQuery({
    queryKey: [...IDEAS_KEY, pillar],
    queryFn: () => listIdeas(pillar === 'auto' ? undefined : pillar),
  });

  const gen = useMutation({
    mutationFn: () => generateIdeas(pillar, count),
    onSuccess: (r) => {
      toast.show(`${r.ideas.length} ide baru dibuat (${r.provider}).`, 'ok');
      void qc.invalidateQueries({ queryKey: IDEAS_KEY });
    },
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  return (
    <Card
      title="Bank ide"
      desc="Kumpulan topik siap pakai. Pilih satu untuk mengisi kolom topik di atas."
    >
      <div className="grid2">
        <Field label="Pilar">
          <Select
            value={pillar}
            onChange={(v) => setPillar(v)}
            options={[
              { value: 'auto', label: 'Semua pilar' },
              ...(boot?.pillars.map((p) => ({ value: p.id, label: p.name })) ?? []),
            ]}
          />
        </Field>

        <Field label="Jumlah ide baru" tip="Maksimal 10 sekali jalan.">
          <TextInput
            type="number"
            min={1}
            max={10}
            value={String(count)}
            onChange={(v) => setCount(Number(v) || 1)}
          />
        </Field>
      </div>

      {/*
        Tombol jadi bagian dari kepala daftar, bukan berdiri sendiri di antara
        form dan daftar.

        Di posisi lamanya ia menggantung tanpa menunjukkan hubungan ke apa pun:
        pilar dan jumlah di atasnya adalah masukannya, daftar di bawahnya
        adalah keluarannya. Disandingkan dengan judul daftar dan jumlah isinya,
        keduanya terbaca sekaligus — apa yang sudah ada, dan cara menambahnya.
      */}
      <div className="list-head">
        <span className="list-head-title">
          Ide tersedia
          {ideas.data && ideas.data.length > 0 && (
            <span className="list-head-num">{ideas.data.length}</span>
          )}
        </span>
        <Button
          label={gen.isPending ? 'Membuat…' : '+ Buatkan ide'}
          onClick={() => gen.mutate()}
          disabled={gen.isPending}
        />
      </div>

      {ideas.isPending && <Spinner />}
      {ideas.error && (
        <ErrorBox error={ideas.error} onRetry={() => void ideas.refetch()} />
      )}
      {ideas.data?.length === 0 && (
        <Empty>
          Belum ada ide. Tekan <strong>Buatkan ide</strong> untuk membuat{' '}
          {count} sekaligus.
        </Empty>
      )}

      {ideas.data && ideas.data.length > 0 && (
        <ul className="idea-list">
          {ideas.data.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                className="idea"
                onClick={() => onPick?.(i.topic, i.pillar)}
                disabled={!onPick}
                title={onPick ? 'Pakai ide ini' : undefined}
              >
                {/*
                  Pilar naik ke pojok sebagai badge supaya tiap ide tetap dua
                  baris. Daftar ini dibaca sambil memilih — judul dan hook yang
                  sejajar rapi membuatnya bisa dipindai sekali lihat, sementara
                  baris ketiga berisi satu kata hanya menggandakan tingginya.
                */}
                <span className="tag idea-pillar">{i.pillar}</span>
                <strong className="idea-topic">{i.topic}</strong>
                {i.hook && <span className="idea-hook">{i.hook}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
