/**
 * ui.tsx — Komponen kecil yang dipakai di banyak fitur.
 *
 * Sengaja tanpa ketergantungan ke lapisan api/ maupun fitur mana pun.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button as PrimeButton } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Slider } from 'primereact/slider';
import { Tooltip } from 'primereact/tooltip';
import { bigger } from './driveUrl';
import type { Attempt } from '@/types/provider';

/* ------------------------------------------------------------------ form */

/*
 * Komponen PrimeReact dibungkus di sini, dan **fitur tidak pernah mengimpor
 * dari `primereact/*` secara langsung**.
 *
 * Alasannya sama dengan kenapa `client.ts` jadi satu-satunya yang memanggil
 * fetch: kalau pustakanya diganti, temanya dirombak, atau satu komponen
 * ternyata perlu perilaku khusus, yang berubah hanya berkas ini — bukan
 * sepuluh berkas fitur.
 */

export type ButtonKind = 'primary' | 'secondary' | 'text' | 'danger';

export function Button({
  kind = 'secondary',
  full,
  className,
  ...rest
}: {
  kind?: ButtonKind;
  /** Memenuhi lebar wadahnya — untuk aksi utama di layar sempit. */
  full?: boolean;
  className?: string;
  label?: string;
  icon?: string;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  /** Wajib saat labelnya hanya simbol, misalnya tombol hapus "×". */
  'aria-label'?: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const severity =
    kind === 'danger' ? 'danger' : kind === 'primary' ? undefined : 'secondary';

  return (
    <PrimeButton
      {...rest}
      type={rest.type ?? 'button'}
      {...(severity ? { severity } : {})}
      text={kind === 'text'}
      outlined={kind === 'danger'}
      className={[full ? 'w-full' : '', className ?? ''].filter(Boolean).join(' ')}
    />
  );
}

export function TextInput({
  value,
  onChange,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  /** Hanya berlaku untuk type="number"; menjaga penjepitan di tingkat browser. */
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  onFocus?: () => void;
  /* React.KeyboardEvent ditulis lengkap, bukan diimpor: nama pendeknya akan
     membayangi tipe DOM global yang dipakai Drawer dan Lightbox di berkas ini. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
}) {
  return <InputText {...rest} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onFocus?: () => void;
}) {
  return (
    <InputTextarea
      {...rest}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoResize={false}
    />
  );
}

export interface Option {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <Dropdown
      {...rest}
      value={value || null}
      options={options}
      optionLabel="label"
      optionValue="value"
      placeholder={placeholder ?? 'Pilih…'}
      // Nilai kosong berarti "tidak disaring", jadi harus bisa dikosongkan lagi.
      showClear={Boolean(value)}
      onChange={(e) => onChange((e.value as string | null) ?? '')}
    />
  );
}

export function CheckBox({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`check${disabled ? ' check-off' : ''}`}>
      <Checkbox
        checked={checked}
        disabled={disabled ?? false}
        onChange={(e) => onChange(Boolean(e.checked))}
      />
      <span>
        {label}
        {hint && <em>{hint}</em>}
      </span>
    </label>
  );
}

export function Range({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <Slider
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(typeof e.value === 'number' ? e.value : (e.value[0] ?? min))}
    />
  );
}

/* ------------------------------------------------------------------ kartu */

export function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      {desc && <p className="card-desc">{desc}</p>}
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- panel */

/**
 * Panel melayang untuk detail sebuah item.
 *
 * Sebelumnya detail dirender di bawah daftar, sehingga mengklik konten di
 * bagian atas memaksa menggulir melewati seluruh daftar untuk melihat
 * hasilnya. Panel ini muncul **di atas** daftar, jadi yang diklik dan yang
 * ditampilkan berada di layar yang sama.
 *
 * Lebar layar menentukan bentuknya lewat CSS: panel samping di laptop, lembar
 * yang naik dari bawah di HP.
 */
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Esc menutup panel — sama seperti lightbox, supaya kebiasaannya seragam.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Mengunci guliran halaman di belakang: tanpa ini, menggulir di dalam panel
  // ikut menggeser daftar di belakangnya dan posisinya hilang saat ditutup.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <div className="drawer-back" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-head">
          <strong>{title}</strong>
          <button type="button" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------------- status */

export function Spinner({ label }: { label?: string }) {
  return (
    <p className="state state-load">
      <span className="spin" aria-hidden="true" />
      {label ?? 'Memuat…'}
    </p>
  );
}

/**
 * Pesan kesalahan yang bisa ditindaklanjuti.
 * Selalu sertakan tombol coba lagi kalau operasinya memang bisa diulang.
 */
export function ErrorBox({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  return (
    <div className="errbox">
      <p className="errbox-msg">{error.message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/* ------------------------------------------------------------------ form */

/**
 * Satu kolom isian beserta labelnya.
 *
 * Dua cara memberi keterangan, dan pilihannya bukan soal selera:
 *
 * - `hint` — teks di bawah kolom. Untuk keterangan yang **perlu dibaca
 *   sebelum mengisi**, misalnya penjelasan akibat dari sebuah pilihan.
 * - `tip` — ikon tanda tanya di samping label, isinya muncul saat disentuh
 *   atau di-hover. Untuk **pengingat sekali lihat** seperti batas angka, yang
 *   kalau ditulis permanen hanya menambah baris di tiap kolom.
 *
 * Keduanya bisa dipakai bersamaan kalau memang ada dua hal berbeda.
 */
export function Field({
  label,
  hint,
  tip,
  children,
}: {
  label: string;
  hint?: string;
  tip?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {tip && <InfoTip text={tip} />}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/**
 * Ikon keterangan dengan tooltip.
 *
 * Dibuat sebagai `button`, bukan `span` bertitle: tooltip bawaan browser tidak
 * pernah muncul di layar sentuh, dan elemen yang bisa difokus membuat isinya
 * terjangkau lewat papan ketik juga.
 *
 * `type="button"` wajib — ia berada di dalam `<label>`, dan tombol tanpa tipe
 * di dalam form akan mengirim formnya saat diklik.
 */
export function InfoTip({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="infotip"
      data-pr-tooltip={text}
      data-pr-position="top"
      aria-label={text}
      // Klik tidak boleh diteruskan ke label, yang akan memindahkan fokus
      // ke kolom isiannya dan menutup tooltip seketika di layar sentuh.
      onClick={(e) => e.preventDefault()}
    >
      ?
    </button>
  );
}

/**
 * Satu instans Tooltip yang melayani seluruh `InfoTip` di halaman.
 *
 * Dipasang sekali di akar aplikasi, bukan satu per ikon: PrimeReact mencari
 * targetnya lewat selector, jadi satu instans sudah cukup untuk semuanya —
 * sementara satu instans per ikon berarti puluhan pengamat DOM yang
 * mengerjakan hal yang sama persis.
 */
export function TooltipHost() {
  return <Tooltip target=".infotip" />;
}

/* ------------------------------------------------------------------ gambar */

/**
 * Pratinjau gambar Drive yang tahan gagal.
 *
 * URL thumbnail Drive butuh berkasnya dibagikan "siapa pun yang punya
 * tautan". Kalau belum, yang kembali halaman login (HTML) dan gambar tampak
 * rusak. Daripada menampilkan ikon rusak bawaan browser, tampilkan kotak
 * kosong beserta petunjuk perbaikannya.
 */
export function Thumb({ src, alt }: { src: string; alt: string }) {
  // Drive membatasi permintaan thumbnail yang datang beruntun. Saat satu
  // carousel memuat tujuh halaman sekaligus, sebagian balasan kembali kosong
  // walaupun izinnya sudah benar. Satu percobaan ulang dengan jeda pendek
  // membedakan kasus itu dari berkas yang memang belum dibagikan.
  const [tries, setTries] = useState(0);
  const [failed, setFailed] = useState(false);

  function onError() {
    if (tries === 0) {
      window.setTimeout(() => setTries(1), 600);
      return;
    }
    setFailed(true);
  }

  if (!src || failed) {
    return (
      <div
        className="ccard-blank"
        title="Pratinjau tidak tersedia — coba 'Bagikan ulang semua gambar' di tab Pengaturan."
      >
        <span>tanpa pratinjau</span>
      </div>
    );
  }

  // Kunci ikut berubah saat mencoba ulang supaya React memasang ulang <img>
  // dan browser benar-benar meminta gambarnya lagi, bukan memakai cache gagal.
  const bust = tries > 0 ? `${src}&retry=${tries}` : src;

  return <img key={tries} src={bust} alt={alt} loading="lazy" onError={onError} />;
}

/* --------------------------------------------------------------- lightbox */

export interface LightboxItem {
  /** Ukuran penuh kalau ada; kalau tidak, thumbnail dipakai apa adanya. */
  src: string;
  caption: string;
}

/**
 * Penampil gambar layar penuh dengan navigasi maju/mundur.
 *
 * Thumbnail di daftar sengaja kecil (sz=w400) agar halaman ringan, jadi di
 * sini gambar diminta ulang pada ukuran besar — teks di dalam desain baru
 * terbaca pada ukuran itu, dan itulah gunanya membuka pratinjau.
 */
export function Lightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: LightboxItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[index];

  // Versi besar bisa ditolak Drive walaupun thumbnailnya tampil. Kalau itu
  // terjadi, turun ke URL thumbnail yang sudah terbukti bisa dimuat — lebih
  // baik gambar buram daripada kotak rusak.
  const [fellBack, setFellBack] = useState(false);
  useEffect(() => setFellBack(false), [index]);

  const prev = useCallback(() => {
    onIndex((index - 1 + items.length) % items.length);
  }, [index, items.length, onIndex]);

  const next = useCallback(() => {
    onIndex((index + 1) % items.length);
  }, [index, items.length, onIndex]);

  // Panah kiri/kanan dan Esc adalah yang pertama dicoba orang pada penampil
  // gambar; tanpa ini lightbox terasa setengah jadi.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  if (!item) return null;

  return (
    <div
      className="lb"
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau gambar"
      onClick={onClose}
    >
      {/* Klik di gambar tidak boleh ikut menutup — hanya latar gelapnya. */}
      <div className="lb-inner" onClick={(e) => e.stopPropagation()}>
        <img
          src={fellBack ? item.src : bigger(item.src)}
          alt={item.caption}
          onError={() => setFellBack(true)}
        />

        <div className="lb-bar">
          <button type="button" onClick={prev} disabled={items.length < 2} aria-label="Sebelumnya">
            ‹
          </button>
          <span className="lb-cap">
            {items.length > 1 && (
              <strong>
                {index + 1}/{items.length}
              </strong>
            )}{' '}
            {item.caption}
          </span>
          <button type="button" onClick={next} disabled={items.length < 2} aria-label="Berikutnya">
            ›
          </button>
        </div>
      </div>

      <button type="button" className="lb-x" onClick={onClose} aria-label="Tutup">
        ✕
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- provider */

/**
 * Ringkasan percobaan provider.
 *
 * Ditampilkan sebagai informasi netral, BUKAN peringatan merah: kuota habis
 * dan perpindahan antar-provider adalah kejadian normal yang memang
 * dirancang, bukan kegagalan aplikasi.
 */
export function AttemptTrail({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) return null;

  const parts = attempts.map((a) => {
    if (a.ok) return `${a.provider} ✓`;
    if (a.skipped) return `${a.provider} dilewati`;
    return `${a.provider} gagal`;
  });

  return <p className="trail">{parts.join(' → ')}</p>;
}

/** Lencana status provider dengan warna sesuai keadaannya. */
export function StateBadge({
  state,
  children,
}: {
  state: 'ok' | 'warn' | 'blocked' | 'off';
  children: ReactNode;
}) {
  return <span className={`badge badge-${state}`}>{children}</span>;
}
