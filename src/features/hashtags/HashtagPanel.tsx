/**
 * Bank hashtag.
 *
 * Rotasi berjalan otomatis di backend berdasarkan yang paling lama tidak
 * dipakai, sehingga dua post berturut-turut tidak pernah punya set hashtag
 * identik. Panel ini hanya untuk melihat dan menyunting isinya.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addHashtag, deleteHashtag, listHashtags } from '@/api';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useToast } from '@/hooks/useToast';
import { Button, Card, Empty, ErrorBox, Field, Select, Spinner, TextInput } from '@/components/ui';

const HASHTAG_KEY = ['hashtags'] as const;

/** Tier menandai seberapa besar jangkauan hashtag. */
const TIERS = [
  { id: 'small', label: 'Kecil (niche)' },
  { id: 'medium', label: 'Sedang' },
  { id: 'large', label: 'Besar (umum)' },
];

export function HashtagPanel() {
  const { data: boot } = useBootstrap();
  const qc = useQueryClient();
  const toast = useToast();

  const [tag, setTag] = useState('');
  const [pillar, setPillar] = useState('all');
  const [tier, setTier] = useState('medium');

  const list = useQuery({ queryKey: HASHTAG_KEY, queryFn: listHashtags });

  const add = useMutation({
    mutationFn: () => addHashtag(tag, pillar, tier),
    onSuccess: (r) => {
      toast.show(`#${r.added} ditambahkan.`, 'ok');
      setTag('');
      void qc.invalidateQueries({ queryKey: HASHTAG_KEY });
    },
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  const del = useMutation({
    mutationFn: (t: string) => deleteHashtag(t),
    onSuccess: () => {
      toast.show('Hashtag dihapus.', 'ok');
      void qc.invalidateQueries({ queryKey: HASHTAG_KEY });
    },
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  return (
    <Card
      title="Bank hashtag"
      desc="Dirotasi otomatis: yang paling lama tidak dipakai dipilih lebih dulu, supaya dua post berturut-turut tidak identik."
    >
      <div className="grid3">
        <Field label="Hashtag" tip="Ditulis tanpa tanda pagar.">
          <TextInput
            value={tag}
            onChange={(v) => setTag(v)}
            placeholder="undangandigital"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tag.trim()) add.mutate();
            }}
          />
        </Field>

        <Field label="Pilar">
          <Select
            value={pillar}
            onChange={(v) => setPillar(v)}
            options={[
              { value: 'all', label: 'Semua pilar' },
              ...(boot?.pillars.map((p) => ({ value: p.id, label: p.name })) ?? []),
            ]}
          />
        </Field>

        <Field label="Tier">
          <Select
            value={tier}
            onChange={(v) => setTier(v)}
            options={TIERS.map((t) => ({ value: t.id, label: t.label }))}
          />
        </Field>
      </div>

      {/* Judul, jumlah, dan aksi penambah dalam satu baris — sama seperti
          bank ide, supaya kedua daftar berperilaku serupa. */}
      <div className="list-head">
        <span className="list-head-title">
          Tersimpan
          {list.data && list.data.length > 0 && (
            <span className="list-head-num">{list.data.length}</span>
          )}
        </span>
        <Button
          label={add.isPending ? 'Menambahkan…' : '+ Tambah'}
          onClick={() => add.mutate()}
          disabled={!tag.trim() || add.isPending}
        />
      </div>

      {list.isPending && <Spinner />}
      {list.error && <ErrorBox error={list.error} onRetry={() => void list.refetch()} />}
      {list.data?.length === 0 && <Empty>Bank hashtag masih kosong.</Empty>}

      {list.data && list.data.length > 0 && (
        <>
          <div className="tag-cloud">
            {list.data.map((h) => (
              <span key={h.tag} className={`htag htag-${h.tier}`}>
                #{h.tag}
                <em title={`dipakai ${h.useCount}x`}>{h.useCount}</em>
                <Button
                  kind="text"
                  label="×"
                  onClick={() => del.mutate(h.tag)}
                  disabled={del.isPending}
                  title="Hapus"
                  aria-label={`Hapus #${h.tag}`}
                />
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
