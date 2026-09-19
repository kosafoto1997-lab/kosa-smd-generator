/**
 * Tab Kalender — jadwal publikasi per bulan.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCalendar, schedulePublish } from '@/api';
import { hijriForMonth, seasonOf } from '@/lib/hijri';
import { CONTENT_LIST_KEY, contentDetailKey } from '@/hooks/queryKeys';
import { useToast } from '@/hooks/useToast';
import { Button, Card, Empty, ErrorBox, Field, Select, Spinner } from '@/components/ui';

/** Bulan berjalan dalam format yyyy-MM. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Hari ini dalam format yyyy-MM-dd.
 *
 * Disusun dari komponen tanggal setempat, bukan `toISOString()` — yang terakhir
 * memakai UTC dan di Indonesia (UTC+7) akan menyebut "kemarin" sepanjang tujuh
 * jam pertama setiap hari.
 */
function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function CalendarPage() {
  const [month, setMonth] = useState(currentMonth());
  const qc = useQueryClient();
  const toast = useToast();

  const cal = useQuery({
    queryKey: ['calendar', month],
    queryFn: () => getCalendar(month),
  });

  const [pick, setPick] = useState('');
  const [when, setWhen] = useState('');
  const [platform, setPlatform] = useState('instagram');

  // Musim nikah bulan ini menurut penanggalan Hijriah.
  const hijri = hijriForMonth(month);
  const season = seasonOf(hijri?.month ?? 0);

  /**
   * Yang jatuh tempo hari ini atau sudah terlewat.
   *
   * Hanya yang belum diposting: jadwal yang sudah dikerjakan bukan lagi
   * tuntutan, dan menampilkannya membuat daftar ini berhenti dipercaya.
   */
  const due = useMemo(() => {
    const today = todayKey();

    return (cal.data?.entries ?? [])
      .filter((e) => e.status !== 'posted')
      .map((e) => ({ ...e, day: String(e.scheduledAt).slice(0, 10) }))
      .filter((e) => e.day <= today)
      .map((e) => ({ ...e, overdue: e.day < today }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [cal.data]);

  /*
    `contentId` dibawa sebagai variabel mutasi, bukan dibaca ulang dari state
    `pick` di dalam onSuccess. Keduanya kebetulan bernilai sama karena
    `setPick('')` baru berlaku pada render berikutnya, tapi mengandalkan hal itu
    terlalu halus: menukar urutan dua baris saja sudah cukup untuk membatalkan
    kunci kosong tanpa ada yang terlihat salah.
  */
  const schedule = useMutation({
    mutationFn: (contentId: string) => schedulePublish(contentId, platform, when),
    onSuccess: (_data, contentId) => {
      toast.show('Jadwal tersimpan.', 'ok');
      setPick('');
      setWhen('');
      void qc.invalidateQueries({ queryKey: ['calendar'] });
      // Menjadwalkan mengubah status dan scheduled_at konten itu, yang tampil
      // di daftar maupun di panel detailnya.
      void qc.invalidateQueries({ queryKey: CONTENT_LIST_KEY });
      void qc.invalidateQueries({ queryKey: contentDetailKey(contentId) });
    },
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  return (
    <div className="stack">
      <Card title="Kalender publikasi">
        <Field label="Bulan">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>

        {/*
          Musim nikah mengikuti penanggalan Hijriah, bukan Masehi: sekitar 15%
          pernikahan setahun menumpuk di Syawal, dan bulan itu bergeser ~11
          hari tiap tahun. Tanpa penanda ini, kalender Masehi saja tidak pernah
          memberi tahu kapan harus bersiap.
        */}
        {hijri && (
          <p className={`season season-${season.level}`}>
            <strong>
              {hijri.monthName} {hijri.year} H — {season.label}
            </strong>
            <span>{season.advice}</span>
          </p>
        )}

        {/*
          Jatuh tempo lebih dulu, tabel belakangan: yang dibutuhkan hari ini
          jauh lebih mendesak daripada jadwal sebulan penuh.
        */}
        {due.length > 0 && (
          <div className="due">
            <h4 className="edit-sub">Jatuh tempo</h4>
            <ul className="due-list">
              {due.map((e) => (
                <li key={e.logId} className={e.overdue ? 'due-late' : ''}>
                  <span className="due-when">{e.overdue ? 'Terlewat' : 'Hari ini'}</span>
                  <span className="due-topic">{e.topic || e.contentId}</span>
                  <span className="dim small">{e.format}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {cal.isPending && <Spinner />}
        {cal.error && <ErrorBox error={cal.error} onRetry={() => void cal.refetch()} />}
        {cal.data?.entries.length === 0 && (
          <Empty>Belum ada yang dijadwalkan bulan ini.</Empty>
        )}

        {cal.data && cal.data.entries.length > 0 && (
          // Dibungkus supaya tabel digulir mendatar di dalam wadahnya sendiri
          // saat layar sempit, bukan menggeser seluruh halaman.
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Topik</th>
                  <th>Format</th>
                  <th>Platform</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cal.data.entries.map((e) => (
                  <tr key={e.logId}>
                    <td>{e.scheduledAt}</td>
                    <td>{e.topic}</td>
                    <td>{e.format}</td>
                    <td>{e.platform}</td>
                    <td>{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Jadwalkan konten" desc="Hanya konten berstatus siap yang bisa dijadwalkan.">
        {cal.data?.ready.length === 0 ? (
          <Empty>Tidak ada konten berstatus siap.</Empty>
        ) : (
          <>
            <div className="grid2">
              <Field label="Konten">
                <Select
                  value={pick}
                  onChange={(v) => setPick(v)}
                  placeholder="Pilih…"
                  options={
                    cal.data?.ready.map((r) => ({
                      value: r.contentId,
                      label: `${r.topic} (${r.format})`,
                    })) ?? []
                  }
                />
              </Field>

              <Field label="Platform">
                <Select
                  value={platform}
                  onChange={(v) => setPlatform(v)}
                  options={[
                    { value: 'instagram', label: 'Instagram' },
                    { value: 'tiktok', label: 'TikTok' },
                    { value: 'youtube', label: 'YouTube' },
                  ]}
                />
              </Field>
            </div>

            <Field label="Waktu terbit">
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </Field>

            <Button
              label={schedule.isPending ? 'Menyimpan…' : 'Jadwalkan'}
              onClick={() => schedule.mutate(pick)}
              disabled={!pick || !when || schedule.isPending}
            />
          </>
        )}
      </Card>
    </div>
  );
}
