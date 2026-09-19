/**
 * EditPanel.tsx — Sunting teks dan tampilan satu konten.
 *
 * Bukan kanvas seret-dan-lepas. Yang ditawarkan di sini adalah kendali atas
 * hal-hal yang paling sering ingin diubah orang — judul kepanjangan, font yang
 * tidak cocok dengan nada, teks kurang terbaca di atas foto terang, posisi
 * blok yang menabrak objek di foto.
 *
 * Setiap perubahan langsung terlihat: kanvasnya digambar ulang sendiri, tanpa
 * tombol pratinjau. Yang membuat itu mungkin adalah gambar mentah yang dimuat
 * sekali di awal dan halaman yang digambar satu per satu — bukan tujuh
 * sekaligus. Rinciannya ada di `useLivePreview.ts`.
 *
 * Menyimpan baru menyentuh Drive dan spreadsheet; sebelum itu bereksperimen
 * sebebas mungkin.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  CheckBox,
  ErrorBox,
  Field,
  Range,
  Spinner,
  TextArea,
  TextInput,
} from '@/components/ui';
import { FontPicker } from '@/components/FontPicker';
import { useEditor, type SlideDraft } from './useEditor';
import { useLivePreview } from './useLivePreview';
import { specFromDetail } from './specFromDetail';
import { withDrafts } from './withDrafts';
import { pageCount, pageLabel } from '@/renderer';
import {
  DESIGN_LIMITS,
  isDefaultDesign,
  sanitizeDesign,
  type DesignOverrides,
  type TextAlign,
  type TextPosition,
} from '@/types/design';
import { BODY_FONTS, FONT_PAIRS, HEADING_FONTS } from '@/types/fonts';
import { brandValue, type Brand } from '@/types/brand';
import type { ContentDetail } from '@/types/api';
import type { Format } from '@/types/content';

const POSITIONS: Array<{ id: TextPosition; label: string }> = [
  { id: 'atas', label: 'Atas' },
  { id: 'tengah', label: 'Tengah' },
  { id: 'bawah', label: 'Bawah' },
];

const ALIGNS: Array<{ id: TextAlign; label: string }> = [
  { id: 'left', label: 'Kiri' },
  { id: 'center', label: 'Tengah' },
];

/** Baca penyetelan tersimpan dari kolom notes, yang isinya bisa apa saja. */
function readDesign(notes: string | undefined): DesignOverrides {
  if (!notes) return {};
  try {
    return sanitizeDesign(JSON.parse(notes));
  } catch {
    // notes juga dipakai untuk catatan bebas seperti "Salinan dari C123".
    // Teks biasa bukan kesalahan — artinya konten ini memakai tampilan bawaan.
    return {};
  }
}

export function EditPanel({
  detail,
  brand,
  pillarName,
  onSaved,
  onClose,
}: {
  detail: ContentDetail;
  brand: Brand;
  pillarName: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const editor = useEditor(brand);
  const format = detail.content.format as Format;

  const [drafts, setDrafts] = useState<SlideDraft[]>(() =>
    detail.slides.map((s) => ({ order: s.order, title: s.title, body: s.body })),
  );
  const [design, setDesign] = useState<DesignOverrides>(() =>
    readDesign(detail.content.notes),
  );
  const [page, setPage] = useState(0);

  const { canvasRef, redraw, ready, error: liveError } = useLivePreview(
    brand,
    detail.content.contentId,
    format,
  );

  const baseSpec = useMemo(() => specFromDetail(detail), [detail]);
  const spec = useMemo(() => withDrafts(baseSpec, drafts), [baseSpec, drafts]);

  const total = pageCount(spec);

  // Halaman aktif bisa melebihi jumlah halaman kalau konten berganti.
  const active = Math.min(page, Math.max(0, total - 1));

  /**
   * Inilah pengganti tombol "Lihat hasil": setiap perubahan teks, setelan,
   * atau halaman aktif langsung memicu gambar ulang.
   *
   * Bergantung pada `redraw` — yang identitasnya stabil — bukan pada objek
   * hook secara utuh, yang baru di tiap render dan akan memicu gambar tanpa
   * henti.
   */
  useEffect(() => {
    redraw({ spec, design, pageIndex: active, pillarName });
  }, [redraw, spec, design, active, pillarName]);

  /** Ubah satu penyetelan; nilai sama dengan bawaan dihapus agar tetap bersih. */
  function setDesignKey<K extends keyof DesignOverrides>(
    key: K,
    value: DesignOverrides[K] | undefined,
  ) {
    setDesign((d) => {
      const next = { ...d };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  /**
   * Geseran slider menggambar pada resolusi hemat.
   *
   * Menggambar penuh di tiap langkah slider membuat tarikan terasa berat;
   * versi hematnya cukup untuk menilai tata letak, dan resolusi penuh menyusul
   * begitu tangan berhenti.
   */
  function dragDesign<K extends keyof DesignOverrides>(
    key: K,
    value: DesignOverrides[K] | undefined,
  ) {
    setDesignKey(key, value);
    redraw({ spec, design: { ...design, [key]: value }, pageIndex: active, pillarName }, true);
  }

  function setDraft(order: number, patch: Partial<SlideDraft>) {
    setDrafts((list) =>
      list.map((d) => (d.order === order ? { ...d, ...patch } : d)),
    );
  }

  /**
   * Terapkan sepasang font sekaligus.
   *
   * Font yang kebetulan sama dengan font merek dihapus dari penyetelan, bukan
   * disimpan sebagai nilai kosong — penyetelan yang bersih membuat "kembalikan
   * tampilan bawaan" tetap bermakna.
   */
  function applyPair(heading: string, body: string) {
    setDesign((d) => {
      const next = { ...d };

      if (heading === brandValue(brand, 'fontHeading')) delete next.fontHeading;
      else next.fontHeading = heading;

      if (body === brandValue(brand, 'fontBody')) delete next.fontBody;
      else next.fontBody = body;

      return next;
    });
  }

  const fontScale = design.fontScale ?? DESIGN_LIMITS.fontScale.default;
  const overlay = design.overlay ?? DESIGN_LIMITS.overlay.default;

  async function doSave() {
    await editor.save(detail, drafts, design, pillarName);
    onSaved();
  }

  return (
    <div className="edit">
      <div className="edit-head">
        <strong>Sunting konten</strong>
        <Button label="Tutup penyuntingan" onClick={onClose} />
      </div>

      <p className="dim small">
        Perubahan langsung terlihat di pratinjau. Tidak ada kuota AI yang
        terpakai, dan tidak ada yang tersimpan sampai kamu menekan Simpan.
      </p>

      <div className="edit-split">
        <div className="edit-controls">
          <h4 className="edit-sub">Teks per halaman</h4>
          {drafts.map((d, i) => (
            <div
              key={d.order}
              className={`edit-slide${i === active ? ' edit-slide-on' : ''}`}
            >
              <Button
                className="edit-num"
                label={String(d.order)}
                onClick={() => setPage(i)}
                title="Lihat halaman ini"
              />
              <div className="stack-tight">
                <Field label="Judul">
                  <TextInput
                    value={d.title}
                    onFocus={() => setPage(i)}
                    onChange={(v) => setDraft(d.order, { title: v })}
                  />
                </Field>
                <Field label="Isi">
                  <TextArea
                    rows={3}
                    value={d.body}
                    onFocus={() => setPage(i)}
                    onChange={(v) => setDraft(d.order, { body: v })}
                  />
                </Field>
              </div>
            </div>
          ))}

          <h4 className="edit-sub">Font</h4>

          <Field label="Pasangan siap pakai" hint="Dua font yang sudah serasi.">
            <div className="row-btn wrap">
              {FONT_PAIRS.map((p) => {
                const on =
                  (design.fontHeading ?? brandValue(brand, 'fontHeading')) === p.heading &&
                  (design.fontBody ?? brandValue(brand, 'fontBody')) === p.body;
                return (
                  <Button
                    key={p.label}
                    kind={on ? 'primary' : 'secondary'}
                    label={p.label}
                    onClick={() => applyPair(p.heading, p.body)}
                  />
                );
              })}
            </div>
          </Field>

          <div className="grid2">
            <FontPicker
              label="Judul"
              choices={HEADING_FONTS}
              value={design.fontHeading}
              fallback={brandValue(brand, 'fontHeading')}
              onChange={(v) => setDesignKey('fontHeading', v)}
            />
            <FontPicker
              label="Isi"
              choices={BODY_FONTS}
              value={design.fontBody}
              fallback={brandValue(brand, 'fontBody')}
              onChange={(v) => setDesignKey('fontBody', v)}
            />
          </div>

          <h4 className="edit-sub">Tampilan</h4>

          <div className="grid2">
            <Field label="Posisi teks">
              <div className="row-btn">
                {POSITIONS.map((p) => (
                  <Button
                    key={p.id}
                    kind={(design.textPosition ?? 'bawah') === p.id ? 'primary' : 'secondary'}
                    label={p.label}
                    onClick={() =>
                      setDesignKey('textPosition', p.id === 'bawah' ? undefined : p.id)
                    }
                  />
                ))}
              </div>
            </Field>

            <Field label="Perataan">
              <div className="row-btn">
                {ALIGNS.map((a) => (
                  <Button
                    key={a.id}
                    kind={(design.textAlign ?? 'left') === a.id ? 'primary' : 'secondary'}
                    label={a.label}
                    onClick={() => setDesignKey('textAlign', a.id === 'left' ? undefined : a.id)}
                  />
                ))}
              </div>
            </Field>
          </div>

          <Field
            label={`Ukuran teks — ${Math.round(fontScale * 100)}%`}
            hint="Kalau teks kepanjangan, ukurannya tetap dikecilkan otomatis agar muat."
          >
            <Range
              min={DESIGN_LIMITS.fontScale.min}
              max={DESIGN_LIMITS.fontScale.max}
              step={DESIGN_LIMITS.fontScale.step}
              value={fontScale}
              onChange={(v) => {
                dragDesign('fontScale', v === DESIGN_LIMITS.fontScale.default ? undefined : v);
              }}
            />
          </Field>

          <Field
            label={`Kegelapan foto — ${Math.round(overlay * 100)}%`}
            hint="Naikkan kalau teks putih sulit terbaca di atas foto yang terang."
          >
            <Range
              min={DESIGN_LIMITS.overlay.min}
              max={DESIGN_LIMITS.overlay.max}
              step={DESIGN_LIMITS.overlay.step}
              value={overlay}
              onChange={(v) => {
                dragDesign('overlay', v === DESIGN_LIMITS.overlay.default ? undefined : v);
              }}
            />
          </Field>

          <div className="row-btn">
            <CheckBox
              checked={design.hideBadge ?? false}
              onChange={(v) => setDesignKey('hideBadge', v || undefined)}
              label="Sembunyikan label pilar"
            />
            <CheckBox
              checked={design.hideHandle ?? false}
              onChange={(v) => setDesignKey('hideHandle', v || undefined)}
              label="Sembunyikan handle Instagram"
            />
          </div>

          {!isDefaultDesign(design) && (
            <Button
              kind="text"
              label="Kembalikan tampilan bawaan"
              onClick={() => setDesign({})}
            />
          )}
        </div>

        {/*
          Kanvas menempel saat digulir supaya hasilnya tetap terlihat sambil
          menyunting teks yang letaknya jauh di bawah.
        */}
        <div className="edit-preview">
          <div className="live-stage">
            {!ready && <Spinner label="Menyiapkan pratinjau…" />}
            <canvas
              ref={canvasRef}
              className={`live-canvas${ready ? '' : ' live-canvas-wait'}`}
            />
          </div>

          {total > 1 && (
            <div className="page-strip">
              {Array.from({ length: total }, (_, i) => (
                <Button
                  key={i}
                  kind={i === active ? 'primary' : 'secondary'}
                  label={String(i + 1)}
                  onClick={() => setPage(i)}
                  title={pageLabel(spec, i)}
                />
              ))}
            </div>
          )}

          <p className="dim small live-label">{pageLabel(spec, active)}</p>

          <div className="row-btn edit-actions">
            <Button
              kind="primary"
              label="Simpan perubahan"
              onClick={() => void doSave()}
              disabled={editor.busy}
            />
          </div>

          {editor.busy && <Spinner label={editor.note || 'Memproses…'} />}
          {!editor.busy && editor.note && <p className="notice">{editor.note}</p>}
          {editor.error && <ErrorBox error={editor.error} />}

          {liveError && !editor.error && (
            <p className="dim small">
              Gambar tersimpan tidak bisa dimuat, jadi pratinjau memakai latar
              polos. Teks dan tata letaknya tetap bisa diatur.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
