/**
 * DesignPage.tsx — Tab Desain: editor kanvas bebas.
 *
 * Berdiri sendiri dari alur AI. Yang di tab Buat memakai template: renderer
 * menata, user memilih dari beberapa pilihan. Di sini kebalikannya — tidak ada
 * yang menata selain user.
 *
 * Tata letaknya tiga kolom: aset di kiri, kanvas di tengah, properti di kanan.
 * Di layar sempit ketiganya menumpuk, kanvas paling atas.
 */
import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { Button, Card, Field, Select } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useBrand } from '@/hooks/useBootstrap';
import { CANVAS_PRESETS, makeShape, makeText, type PresetId } from '@/types/canvas';
import { useCanvasDoc } from './useCanvasDoc';
import { CanvasStage } from './CanvasStage';
import { AssetPanel } from './AssetPanel';
import { LayerPanel } from './LayerPanel';
import { PropertyPanel } from './PropertyPanel';

/** Lebar kanvas di layar. Nilai logisnya tetap 1080px. */
const STAGE_MAX_W = 460;

export function DesignPage() {
  const toast = useToast();
  const brand = useBrand();
  const api = useCanvasDoc();
  const stageRef = useRef<Konva.Stage | null>(null);

  const size = CANVAS_PRESETS[api.doc.preset];
  const scale = STAGE_MAX_W / size.w;

  const selected = api.doc.elements.find((e) => e.id === api.selectedIds[0]) ?? null;

  /*
    Pintasan papan tik.

    Sengaja diabaikan saat fokus berada di kolom isian: menekan Delete sambil
    menyunting teks harus menghapus huruf, bukan elemennya.
  */
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;

      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) api.redo();
        else api.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        api.duplicate(api.selectedIds);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!api.selectedIds.length) return;
        e.preventDefault();
        api.remove(api.selectedIds);
        return;
      }
      if (e.key === 'Escape') api.select([]);

      // Panah menggeser: 1px untuk penyetelan halus, 10px dengan Shift.
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const d = nudge[e.key];
      if (d && api.selectedIds.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        api.selectedIds.forEach((id) => {
          const el = api.doc.elements.find((x) => x.id === id);
          if (!el || el.locked) return;
          api.patch(id, { x: el.x + d[0] * step, y: el.y + d[1] * step });
        });
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);

  /**
   * Unduh hasil sebagai PNG.
   *
   * `pixelRatio` mengembalikan ukuran penuh: panggung tampil sekitar 460px di
   * layar, tapi yang diunduh harus 1080px — kalau tidak, hasilnya buram saat
   * diunggah ke Instagram.
   */
  function download() {
    const stage = stageRef.current;
    if (!stage) return;
    setBusy(true);
    try {
      // Seleksi dilepas dulu supaya pegangan transform tidak ikut tergambar.
      const keep = api.selectedIds;
      api.select([]);

      // Satu frame supaya Konva sempat menggambar ulang tanpa pegangan.
      requestAnimationFrame(() => {
        try {
          const url = stage.toDataURL({ pixelRatio: 1 / scale, mimeType: 'image/png' });
          const a = document.createElement('a');
          a.href = url;
          a.download = `desain-${Date.now()}.png`;
          a.click();
          toast.show('Gambar diunduh.', 'ok');
        } catch {
          toast.show('Gagal mengunduh gambar.', 'error');
        } finally {
          api.select(keep);
          setBusy(false);
        }
      });
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="dz">
      <div className="dz-left">
        <AssetPanel
          doc={api.doc}
          brand={brand}
          onAdd={api.add}
          onBackground={api.setBackground}
        />
      </div>

      <div className="dz-center">
        <Card title="Kanvas">
          <div className="row-btn wrap dz-toolbar">
            <Field label="Ukuran">
              <Select
                value={api.doc.preset}
                onChange={(v) => api.setPreset(v as PresetId)}
                options={Object.entries(CANVAS_PRESETS).map(([id, p]) => ({
                  value: id,
                  label: p.label,
                }))}
              />
            </Field>
            <Button
              label="Teks"
              onClick={() => api.add(makeText(Math.round(size.w * 0.1), Math.round(size.h * 0.4)))}
            />
            <Button
              label="Kotak"
              onClick={() =>
                api.add(makeShape('rect', Math.round(size.w * 0.3), Math.round(size.h * 0.4)))
              }
            />
            <Button
              label="Lingkaran"
              onClick={() =>
                api.add(makeShape('ellipse', Math.round(size.w * 0.3), Math.round(size.h * 0.4)))
              }
            />
            <Button
              label="Garis"
              onClick={() =>
                api.add(makeShape('line', Math.round(size.w * 0.2), Math.round(size.h * 0.5)))
              }
            />
          </div>

          <div className="row-btn wrap dz-toolbar">
            <Button label="Urungkan" onClick={api.undo} disabled={!api.canUndo} />
            <Button label="Ulangi" onClick={api.redo} disabled={!api.canRedo} />
            <Button
              label="Duplikat"
              onClick={() => api.duplicate(api.selectedIds)}
              disabled={!api.selectedIds.length}
            />
            <Button
              label="Hapus"
              onClick={() => api.remove(api.selectedIds)}
              disabled={!api.selectedIds.length}
            />
            <Button kind="primary" label="Unduh PNG" onClick={download} disabled={busy} />
          </div>

          <div className="dz-stage-wrap">
            <CanvasStage
              doc={api.doc}
              selectedIds={api.selectedIds}
              scale={scale}
              onSelect={api.select}
              onPatch={api.patch}
              onCommit={api.commit}
              stageRef={stageRef}
            />
          </div>

          <p className="dim small">
            Klik untuk memilih, seret untuk memindah, tarik sudut untuk mengubah ukuran.
            Ctrl+Z urungkan, Ctrl+D duplikat, Delete hapus, panah geser 1px (Shift 10px).
          </p>
        </Card>
      </div>

      <div className="dz-right">
        <PropertyPanel element={selected} onPatch={api.patch} onCommit={api.commit} />
        <LayerPanel
          doc={api.doc}
          selectedIds={api.selectedIds}
          onSelect={api.select}
          onPatch={api.patch}
          onReorder={api.reorder}
        />
      </div>
    </div>
  );
}
