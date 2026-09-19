/**
 * Tab Library — daftar konten yang sudah dibuat.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteContent,
  getContent,
  listContent,
  updateCaption,
  updateContentStatus,
} from '@/api';
import { useBootstrap, useBrand } from '@/hooks/useBootstrap';
import { CONTENT_LIST_KEY, contentDetailKey } from '@/hooks/queryKeys';
import { useToast } from '@/hooks/useToast';
import {
  Button,
  Drawer,
  Empty,
  ErrorBox,
  Field,
  Lightbox,
  Select,
  Spinner,
  TextArea,
  TextInput,
  Thumb,
  type LightboxItem,
} from '@/components/ui';
import { useRerender } from './useRerender';
import { useDownload } from './useDownload';
import { useDuplicate } from './useDuplicate';
import { EditPanel } from './EditPanel';
import type { ContentFilter, ContentSummary, Format, Status } from '@/types/content';

const STATUS: Array<{ id: Status; label: string }> = [
  { id: 'draft', label: 'Draft' },
  { id: 'ready', label: 'Siap' },
  { id: 'approved', label: 'Disetujui' },
  { id: 'posted', label: 'Terbit' },
];

const FORMATS: Array<{ id: Format; label: string }> = [
  { id: 'carousel', label: 'Carousel' },
  { id: 'feed', label: 'Feed' },
  { id: 'story', label: 'Story' },
  { id: 'reels', label: 'Reels' },
  { id: 'shorts', label: 'Shorts' },
];

type View = 'kartu' | 'grid';

export function LibraryPage() {
  const [filter, setFilter] = useState<ContentFilter>({});
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('kartu');
  const [openId, setOpenId] = useState<string | null>(null);

  /*
    Seluruh konten diambil sekali tanpa penyaring apa pun, lalu disaring di
    klien. Backend membatasi 100 baris, jadi biayanya kecil — dan imbalannya
    besar: jumlah per status bisa dihitung dan ditampilkan di pilnya, sesuatu
    yang mustahil kalau server sudah menyaring lebih dulu.
  */
  const list = useQuery({
    queryKey: CONTENT_LIST_KEY,
    queryFn: () => listContent({}),
  });

  const all = list.data ?? [];

  const q = search.trim().toLowerCase();
  const shown = all.filter((c) => {
    if (filter.status && c.status !== filter.status) return false;
    if (filter.format && c.format !== filter.format) return false;
    if (!q) return true;
    return [c.topic, c.hook, c.caption, c.hashtags, c.pillar]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  /** Jumlah konten per status, untuk angka di pil penyaring. */
  const counts = new Map<string, number>();
  for (const c of all) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);

  /** Ubah satu kunci penyaring; memilih yang sedang aktif berarti mematikannya. */
  function toggle<K extends keyof ContentFilter>(key: K, value: string) {
    setFilter((f) => {
      const next = { ...f };
      if (!value || f[key] === value) delete next[key];
      else next[key] = value as ContentFilter[K];
      return next;
    });
  }

  const filtering = Boolean(q || filter.status || filter.format);

  return (
    <div className="lib">
      {/*
        Bilah penyaring, bukan kartu penuh.

        Versi sebelumnya membungkus pencarian dan dua dropdown dalam sebuah
        kartu bertingkat yang memakan hampir seluruh layar pertama di HP —
        satu konten pun belum terlihat sebelum menggulir. Di sini penyaringnya
        setipis mungkin: satu baris pencarian, lalu pil yang langsung bisa
        diketuk tanpa membuka dropdown lebih dulu.
      */}
      <div className="lib-bar">
        <div className="lib-search">
          <TextInput
            type="search"
            value={search}
            onChange={setSearch}
            placeholder="Cari topik, hook, caption, hashtag…"
            aria-label="Cari konten"
          />
        </div>

        <div className="lib-filters">
          <div className="pills" role="group" aria-label="Saring status">
            <Button
              kind={!filter.status ? 'primary' : 'secondary'}
              onClick={() => toggle('status', '')}
              label={`Semua ${all.length}`}
            />
            {STATUS.map((s) => {
              const n = counts.get(s.id) ?? 0;
              return (
                <Button
                  key={s.id}
                  kind={filter.status === s.id ? 'primary' : 'secondary'}
                  onClick={() => toggle('status', s.id)}
                  label={`${s.label} ${n}`}
                  /* Status tanpa satu pun konten tidak bisa dipilih — mengetuknya
                     hanya menghasilkan daftar kosong. */
                  disabled={n === 0 && filter.status !== s.id}
                />
              );
            })}
          </div>

          <div className="lib-bar-end">
            <div className="lib-format">
              <Select
                value={filter.format ?? ''}
                onChange={(v) => toggle('format', v)}
                options={FORMATS.map((f) => ({ value: f.id, label: f.label }))}
                placeholder="Semua format"
                aria-label="Saring format"
              />
            </div>

            <div className="seg" role="group" aria-label="Tampilan">
              <button
                className={view === 'kartu' ? 'seg-on' : ''}
                onClick={() => setView('kartu')}
                aria-pressed={view === 'kartu'}
              >
                Kartu
              </button>
              <button
                className={view === 'grid' ? 'seg-on' : ''}
                onClick={() => setView('grid')}
                aria-pressed={view === 'grid'}
                title="Simulasi tampilan feed Instagram"
              >
                Grid feed
              </button>
            </div>
          </div>
        </div>

        {filtering && (
          <div className="lib-count">
            <span className="dim small">
              {shown.length} dari {all.length} konten
            </span>
            <Button
              kind="text"
              label="Hapus penyaring"
              onClick={() => {
                setSearch('');
                setFilter({});
              }}
            />
          </div>
        )}
      </div>

      <section className="lib-main">
        {list.isPending && <Spinner />}
        {list.error && (
          <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
        )}

        {list.data && all.length === 0 && (
          <Empty>Belum ada konten. Buat yang pertama di tab Generate.</Empty>
        )}
        {all.length > 0 && shown.length === 0 && (
          <Empty>Tidak ada konten yang cocok dengan penyaring ini.</Empty>
        )}

        {shown.length > 0 &&
          (view === 'kartu' ? (
            <div className="cards">
              {shown.map((c) => (
                <ContentCard key={c.contentId} item={c} onOpen={setOpenId} />
              ))}
            </div>
          ) : (
            <GridPreview items={shown} onOpen={setOpenId} />
          ))}
      </section>

      {openId && (
        // key memaksa Detail dipasang ulang saat berpindah konten, sehingga
        // panel penyuntingan dan draft teksnya tidak terbawa ke konten lain.
        <Detail
          key={openId}
          contentId={openId}
          onClose={() => setOpenId(null)}
          onOpenOther={setOpenId}
        />
      )}
    </div>
  );
}

/**
 * Simulasi tampilan feed Instagram — grid 3 kolom, terbaru di kiri atas.
 *
 * Riset menyebut estetika feed sebagai alasan utama UMKM memakai tool seperti
 * ini: apakah post baru serasi dengan yang sudah ada baru terlihat saat
 * dipandang bersamaan, bukan satu per satu.
 */
function GridPreview({
  items,
  onOpen,
}: {
  items: ContentSummary[];
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <p className="dim small">
        Urutan seperti di profil Instagram: terbaru di kiri atas.
      </p>
      <div className="ig-grid">
        {items.map((c) => (
          <button
            key={c.contentId}
            type="button"
            className="ig-cell"
            onClick={() => onOpen(c.contentId)}
            title={c.topic}
          >
            <Thumb src={c.thumb} alt={c.topic} />
            {c.slideCount > 1 && <span className="ig-badge">{c.slideCount}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function ContentCard({
  item,
  onOpen,
}: {
  item: ContentSummary;
  onOpen: (id: string) => void;
}) {
  const label = STATUS.find((s) => s.id === item.status)?.label ?? item.status;

  return (
    <button type="button" className="ccard" onClick={() => onOpen(item.contentId)}>
      <div className="ccard-media">
        <Thumb src={item.thumb} alt={item.topic} />
        {/*
          Status dan jumlah halaman ditumpangkan di atas gambar, bukan di
          bawahnya. Keduanya dibaca sekilas saat memindai banyak kartu, dan
          memindahkannya ke sini menyisakan ruang di badan kartu untuk judul —
          satu-satunya hal yang benar-benar perlu dibaca utuh.
        */}
        <span className={`dot dot-${item.status}`} title={label}>
          {label}
        </span>
        {item.slideCount > 1 && <span className="ig-badge">{item.slideCount}</span>}
      </div>
      <div className="ccard-body">
        <strong>{item.topic || '(tanpa topik)'}</strong>
        <span className="dim small">
          {item.format} · {item.pillar}
        </span>
      </div>
    </button>
  );
}

function Detail({
  contentId,
  onClose,
  onOpenOther,
}: {
  contentId: string;
  onClose: () => void;
  /** Pindah ke konten lain, dipakai setelah membuat duplikat. */
  onOpenOther: (id: string) => void;
}) {
  const qc = useQueryClient();
  const brand = useBrand();
  const { data: boot } = useBootstrap();
  const toast = useToast();

  /*
    `placeholderData` menahan data konten yang tadi dibuka selama yang baru
    diambil, jadi berpindah antar konten tidak lagi mengosongkan panel jadi
    spinner. Yang tampil sekejap memang milik konten sebelumnya — itu sebabnya
    `isPlaceholderData` dipakai di bawah untuk meredupkan panel, supaya tidak
    ada yang menyunting data yang sebenarnya belum berganti.
  */
  const detail = useQuery({
    queryKey: contentDetailKey(contentId),
    queryFn: () => getContent(contentId),
    placeholderData: (prev) => prev,
  });

  const setStatus = useMutation({
    mutationFn: (status: Status) => updateContentStatus(contentId, status),
    onSuccess: () => {
      toast.show('Status diperbarui.', 'ok');
      // Hanya konten ini yang berubah; detail konten lain tidak perlu ikut basi.
      void qc.invalidateQueries({ queryKey: CONTENT_LIST_KEY });
      void qc.invalidateQueries({ queryKey: contentDetailKey(contentId) });
    },
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  const [caption, setCaption] = useState<string | null>(null);
  const shown = caption ?? detail.data?.content.caption ?? '';
  const changed = caption !== null && caption !== detail.data?.content.caption;

  const saveCaption = useMutation({
    mutationFn: () => updateCaption(contentId, shown),
    onSuccess: () => {
      toast.show('Caption tersimpan dan dibersihkan dari kata terlarang.', 'ok');
      setCaption(null);
      void qc.invalidateQueries({ queryKey: CONTENT_LIST_KEY });
      void qc.invalidateQueries({ queryKey: contentDetailKey(contentId) });
    },
    onError: (e: Error) => toast.show(e.message, 'error'),
  });

  const rerender = useRerender(brand);
  const duplicate = useDuplicate(brand);
  const download = useDownload(brand);

  /** Dibuka sebagai langkah kedua sebelum menghapus. */
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = useMutation({
    mutationFn: () => deleteContent(contentId),
    onSuccess: (r) => {
      toast.show(
        r.failedFiles > 0
          ? `Konten dihapus. ${r.files} berkas dibuang, ${r.failedFiles} tidak terjangkau.`
          : `Konten dan ${r.files} berkas dibuang ke tempat sampah Drive.`,
        'ok',
      );
      void qc.invalidateQueries({ queryKey: CONTENT_LIST_KEY });
      void qc.invalidateQueries({ queryKey: ['calendar'] });
      void qc.invalidateQueries({ queryKey: ['bootstrap'] });
      // Dibuang, bukan dibatalkan: kontennya sudah tidak ada, jadi mengambilnya
      // lagi hanya akan menghasilkan "tidak ditemukan" dari backend.
      qc.removeQueries({ queryKey: contentDetailKey(contentId) });
      // Panel ditutup: kontennya sudah tidak ada, jadi tidak ada yang bisa
      // ditampilkan lagi di sini.
      onClose();
    },
    onError: (e: Error) => {
      toast.show(e.message, 'error');
      setConfirmDelete(false);
    },
  });

  /** Jumlah halaman menentukan apakah unduhan perlu dibungkus arsip. */
  const slideCount = detail.data?.slides.length ?? 1;

  // Satu lightbox dipakai bergantian oleh dua kumpulan gambar (halaman
  // tersimpan dan hasil render ulang), jadi isinya disimpan saat dibuka.
  const [lb, setLb] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [editing, setEditing] = useState(false);

  const slideItems: LightboxItem[] = (detail.data?.slides ?? []).map((s) => ({
    src: s.thumb,
    caption: `${s.order}. ${s.title}`,
  }));

  const renderItems: LightboxItem[] = rerender.images.map((img) => ({
    src: img.dataUrl,
    caption: img.label,
  }));

  /** Nama pilar untuk label kapsul di halaman sampul. */
  function pillarName(): string {
    const id = detail.data?.content.pillar ?? '';
    return boot?.pillars.find((p) => p.id === id)?.name ?? id;
  }

  async function doRerender() {
    await rerender.run(contentId, pillarName());
    // Gambarnya berganti, jadi thumbnail di daftar dan di detail ini ikut basi.
    void qc.invalidateQueries({ queryKey: CONTENT_LIST_KEY });
    void qc.invalidateQueries({ queryKey: contentDetailKey(contentId) });
  }

  async function doDuplicate() {
    await duplicate.run(contentId, pillarName());
    // Salinannya konten baru; konten sumber yang sedang dibuka tidak berubah,
    // jadi cukup daftarnya saja yang disegarkan.
    void qc.invalidateQueries({ queryKey: CONTENT_LIST_KEY });
  }

  async function doDownload() {
    // Tidak menyentuh spreadsheet maupun Drive, jadi tidak ada yang perlu
    // dimuat ulang sesudahnya.
    await download.run(contentId, pillarName());
  }

  function copyCaption() {
    const text = `${shown}\n\n${detail.data?.content.hashtags ?? ''}`.trim();
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.show('Caption disalin.', 'ok'))
      .catch(() => toast.show('Gagal menyalin.', 'error'));
  }

  return (
    <Drawer title={detail.data?.content.topic || 'Detail konten'} onClose={onClose}>
      {detail.isPending && <Spinner />}
      {detail.error && <ErrorBox error={detail.error} />}

      {/*
        Saat yang tampil masih milik konten sebelumnya, panel diredupkan dan
        klik dimatikan. Tanpa penanda itu, data lama terlihat persis seperti
        data final — dan menyunting caption di atasnya berarti menimpa konten
        yang salah.
      */}
      {detail.isPlaceholderData && (
        <p className="dim small">Memuat konten…</p>
      )}

      {detail.data && (
        /*
          Dua kolom di panel yang lebar: gambar di kiri, semua yang perlu
          diketik dan diklik di kanan.

          Sebelumnya semuanya satu kolom memanjang, sehingga panel selebar
          1100px dipakai untuk memperbesar thumbnail sementara caption, status,
          dan tombol unduh terdorong keluar layar. Lebar seharusnya memendekkan
          guliran, bukan membesarkan gambar.
        */
        <div
          className="det"
          /*
            Dimatikan selama data lama masih tampil, supaya tidak ada tombol
            atau kolom teks yang bekerja pada konten yang salah.

            `pointerEvents` dan `opacity`, bukan atribut `inert`: React 18 belum
            meneruskan `inert` ke DOM, jadi atribut itu hanya akan hilang diam-
            diam dan panel tetap bisa diklik.
          */
          style={
            detail.isPlaceholderData
              ? { opacity: 0.45, pointerEvents: 'none' }
              : undefined
          }
          aria-busy={detail.isPlaceholderData || undefined}
        >
          <div className="det-media">
            <p className="det-meta">
              <span className={`dot dot-${detail.data.content.status}`}>
                {STATUS.find((s) => s.id === detail.data.content.status)?.label ??
                  detail.data.content.status}
              </span>
              <span className="dim small">
                {detail.data.content.format} · {detail.data.content.pillar}
              </span>
            </p>

            {detail.data.slides.length > 0 && (
              <div className="thumbs">
                {detail.data.slides.map((s, i) => (
                  <figure key={s.order}>
                    <button
                      type="button"
                      className="zoom"
                      onClick={() => setLb({ items: slideItems, index: i })}
                      title="Klik untuk memperbesar"
                    >
                      <Thumb src={s.thumb} alt={s.title} />
                    </button>
                    <figcaption>
                      {s.order}. {s.title}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            {rerender.images.length > 0 && (
              <>
                <p className="dim small">Hasil render ulang:</p>
                <div className="thumbs">
                  {rerender.images.map((img, i) => (
                    <figure key={img.index}>
                      <button
                        type="button"
                        className="zoom"
                        onClick={() => setLb({ items: renderItems, index: i })}
                        title="Klik untuk memperbesar"
                      >
                        <img src={img.dataUrl} alt={img.label} loading="lazy" />
                      </button>
                      <figcaption>{img.label}</figcaption>
                    </figure>
                  ))}
                </div>
              </>
            )}

            <p className="det-made dim small">
              Dibuat {detail.data.content.createdAt}
            </p>
          </div>

          <div className="det-side">
            {/*
              Dua aksi yang paling sering dipakai, di paling atas kolom: unduh
              gambarnya lalu salin captionnya — persis yang dibutuhkan
              bersamaan saat hendak memposting.
            */}
            <div className="det-act">
              <Button
                kind="primary"
                onClick={() => void doDownload()}
                disabled={download.running}
                label={
                  download.running
                    ? 'Menyiapkan…'
                    : slideCount > 1
                      ? `Unduh ${slideCount} gambar (ZIP)`
                      : 'Unduh gambar'
                }
              />
              <Button label="Salin caption" onClick={copyCaption} />
            </div>

            {download.note && <p className="dim small">{download.note}</p>}
            {download.warning && <p className="notice">{download.warning}</p>}
            {download.error && <ErrorBox error={download.error} />}

            <Field
              label="Caption"
              hint="Kata terlarang dibersihkan otomatis saat disimpan."
            >
              <TextArea rows={10} value={shown} onChange={setCaption} />
            </Field>

            {changed && (
              <div className="row-btn wrap">
                <Button
                  kind="primary"
                  onClick={() => saveCaption.mutate()}
                  disabled={saveCaption.isPending}
                  label={saveCaption.isPending ? 'Menyimpan…' : 'Simpan caption'}
                />
                <Button label="Batalkan" onClick={() => setCaption(null)} />
              </div>
            )}

            <Field label="Status">
              <div className="pills">
                {STATUS.map((s) => (
                  <Button
                    key={s.id}
                    kind={detail.data.content.status === s.id ? 'primary' : 'secondary'}
                    label={s.label}
                    onClick={() => setStatus.mutate(s.id)}
                    disabled={setStatus.isPending || detail.data.content.status === s.id}
                  />
                ))}
              </div>
            </Field>

            {editing ? (
              <EditPanel
                detail={detail.data}
                brand={brand}
                pillarName={pillarName()}
                onSaved={() => {
                  void qc.invalidateQueries({ queryKey: CONTENT_LIST_KEY });
                  void qc.invalidateQueries({ queryKey: contentDetailKey(contentId) });
                }}
                onClose={() => setEditing(false)}
              />
            ) : (
              <Field
                label="Ubah tanpa memakai kuota AI"
                hint="Semuanya memakai gambar tersimpan di 99_Raw_AI, tidak menyentuh provider AI sama sekali."
              >
                <div className="row-btn wrap">
                  <Button
                    kind="primary"
                    label="Sunting teks & tampilan"
                    onClick={() => setEditing(true)}
                  />
                  <Button
                    onClick={() => void doRerender()}
                    disabled={rerender.running || duplicate.running}
                    label={rerender.running ? 'Merender…' : 'Render ulang'}
                  />
                  <Button
                    onClick={() => void doDuplicate()}
                    disabled={rerender.running || duplicate.running}
                    title="Buat salinan sebagai konten baru"
                    label={duplicate.running ? 'Menggandakan…' : 'Duplikat'}
                  />
                </div>
              </Field>
            )}

            {rerender.note && <p className="dim small">{rerender.note}</p>}
            {rerender.error && <ErrorBox error={rerender.error} />}

            {duplicate.note && (
              <p className="notice">
                {duplicate.note}
                {duplicate.newId && (
                  <>
                    {' '}
                    <Button
                      kind="text"
                      label="Buka salinan"
                      onClick={() => onOpenOther(duplicate.newId!)}
                    />
                  </>
                )}
              </p>
            )}
            {duplicate.error && <ErrorBox error={duplicate.error} />}

            {/*
              Paling bawah dan terpisah, jauh dari aksi lain: ini satu-satunya
              tombol di aplikasi yang tidak bisa dibatalkan.

              Konfirmasinya dua langkah di dalam halaman, bukan confirm() bawaan
              peramban — dialog bawaan muncul di tempat yang sama dengan dialog
              lain dan sering diklik refleks tanpa dibaca.
            */}
            <div className="danger">
              {!confirmDelete ? (
                <Button
                  kind="danger"
                  label="Hapus konten ini"
                  onClick={() => setConfirmDelete(true)}
                />
              ) : (
                <>
                  <p className="danger-msg">
                    Hapus <strong>{detail.data.content.topic || contentId}</strong>?
                    {slideCount > 1 ? ` ${slideCount} gambar` : ' Gambarnya'} ikut
                    dibuang ke tempat sampah Drive, begitu juga jadwal terbitnya.
                    <br />
                    Tindakan ini tidak bisa dibatalkan dari aplikasi.
                  </p>
                  <div className="row-btn wrap">
                    <Button
                      kind="danger"
                      onClick={() => remove.mutate()}
                      disabled={remove.isPending}
                      label={remove.isPending ? 'Menghapus…' : 'Ya, hapus permanen'}
                    />
                    <Button
                      label="Batal"
                      onClick={() => setConfirmDelete(false)}
                      disabled={remove.isPending}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {lb && (
        <Lightbox
          items={lb.items}
          index={lb.index}
          onIndex={(i) => setLb((s) => (s ? { ...s, index: i } : s))}
          onClose={() => setLb(null)}
        />
      )}
    </Drawer>
  );
}
