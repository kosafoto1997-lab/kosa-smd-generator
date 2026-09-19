/**
 * FontPicker.tsx — Pemilih font yang tiap barisnya tampil dengan huruf aslinya.
 *
 * Menampilkan dua puluhan nama font dengan typeface masing-masing terdengar
 * mahal, tapi tidak: yang diunduh per baris hanyalah glyph untuk nama font itu
 * sendiri, lewat parameter `text=` Google Fonts. Satu baris berarti berkas
 * berisi belasan huruf, bukan alfabet penuh.
 *
 * Pemuatannya pun ditunda sampai barisnya benar-benar terlihat, jadi membuka
 * daftar tidak menembakkan tiga puluh permintaan sekaligus.
 */
import { useEffect, useRef, useState } from 'react';
import { ensurePreviewFont, previewFamily } from '@/renderer';
import { FONT_NAME_MAX, sanitizeFontName, type FontChoice } from '@/types/fonts';

/**
 * Muat font pratinjau saat baris masuk layar.
 *
 * Tanpa penundaan ini, daftar berisi 12 pilihan akan meminta 12 berkas begitu
 * dibuka — sebagian besar untuk baris yang tidak pernah digulir.
 */
function useFontOnVisible(name: string) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || loaded) return;

    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void ensurePreviewFont(name).then(() => setLoaded(true));
    });

    io.observe(el);
    return () => io.disconnect();
  }, [name, loaded]);

  return { ref, loaded };
}

function FontRow({
  choice,
  active,
  onPick,
}: {
  choice: FontChoice;
  active: boolean;
  onPick: () => void;
}) {
  const { ref, loaded } = useFontOnVisible(choice.name);

  return (
    <button
      ref={ref}
      type="button"
      className={`font-row${active ? ' font-row-on' : ''}`}
      onClick={onPick}
      title={choice.note}
    >
      {/*
        Sebelum fontnya siap, nama tetap tampil dengan huruf antarmuka biasa.
        Menyembunyikannya akan membuat daftar berkedip saat digulir.

        Nama keluarga pratinjau sengaja berbeda dari nama font sungguhan;
        alasannya ada di `previewFamily()`.
      */}
      <span style={loaded ? { fontFamily: `"${previewFamily(choice.name)}", serif` } : undefined}>
        {choice.name}
      </span>
      <small className="dim">{choice.note}</small>
    </button>
  );
}

export function FontPicker({
  label,
  choices,
  value,
  fallback,
  onChange,
}: {
  label: string;
  choices: FontChoice[];
  /** Nilai terpilih; kosong berarti mengikuti font merek. */
  value: string | undefined;
  /** Font merek, ditampilkan sebagai "bawaan". */
  fallback: string;
  onChange: (name: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const current = value ?? fallback;
  const known = choices.some((c) => c.name === current);

  function pick(name: string) {
    // Memilih font yang sama dengan merek berarti "tidak ada penyimpangan",
    // jadi override-nya dibuang agar penyetelan tetap bersih.
    onChange(name === fallback ? undefined : name);
    setOpen(false);
  }

  function applyCustom() {
    const clean = sanitizeFontName(custom);
    if (clean) pick(clean);
    setCustom('');
  }

  return (
    <div className="font-picker">
      <button
        type="button"
        className="font-current"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-label dim">{label}</span>
        <span className="font-name">{current}</span>
        <span className="font-caret" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="font-list">
          {choices.map((c) => (
            <FontRow
              key={c.name}
              choice={c}
              active={c.name === current}
              onPick={() => pick(c.name)}
            />
          ))}

          {/*
            Jalan keluar untuk yang sudah tahu persis maunya. Nama apa pun dari
            Google Fonts bisa dipakai, walau tidak ada di daftar kurasi.
          */}
          <div className="font-custom">
            <input
              value={custom}
              maxLength={FONT_NAME_MAX}
              placeholder="Font Google lain…"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyCustom();
                }
              }}
            />
            <button type="button" onClick={applyCustom} disabled={!sanitizeFontName(custom)}>
              Pakai
            </button>
          </div>

          {!known && (
            <p className="dim small font-note">
              <strong>{current}</strong> di luar daftar. Kalau namanya salah
              ketik, tampilannya diam-diam jatuh ke font cadangan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
