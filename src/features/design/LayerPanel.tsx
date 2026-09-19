/**
 * LayerPanel.tsx — Daftar elemen sebagai tumpukan layer.
 *
 * Ditampilkan TERBALIK dari urutan penyimpanan: yang paling atas di layar
 * adalah yang paling depan di kanvas. Itu yang dilihat orang — elemen yang
 * menutupi elemen lain memang terasa "di atas", dan daftar yang urutannya
 * berlawanan dengan kanvas membuat tombol naik/turun terasa terbalik.
 */
import { Button, Card } from '@/components/ui';
import { elementLabel, type CanvasDoc, type CanvasElement } from '@/types/canvas';

interface Props {
  doc: CanvasDoc;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onPatch: (id: string, changes: Partial<CanvasElement>, commit?: boolean) => void;
  onReorder: (id: string, to: number) => void;
}

export function LayerPanel({ doc, selectedIds, onSelect, onPatch, onReorder }: Props) {
  const total = doc.elements.length;

  if (!total) {
    return (
      <Card title="Layer">
        <p className="dim small">Belum ada elemen. Tambahkan teks, bentuk, atau gambar.</p>
      </Card>
    );
  }

  // Disalin sebelum dibalik: `reverse()` mengubah array aslinya, dan array itu
  // adalah state dokumen.
  const rows = doc.elements.map((el, i) => ({ el, index: i })).reverse();

  return (
    <Card title={`Layer (${total})`}>
      <ul className="dz-layers">
        {rows.map(({ el, index }) => {
          const on = selectedIds.includes(el.id);
          return (
            <li key={el.id} className={`dz-layer${on ? ' dz-layer-on' : ''}`}>
              <button
                type="button"
                className="dz-layer-name"
                onClick={() => onSelect([el.id])}
                title={elementLabel(el)}
              >
                <span className="dz-layer-kind">
                  {el.type === 'text' ? 'T' : el.type === 'image' ? '🖼' : '◆'}
                </span>
                <span className="dz-layer-text">{elementLabel(el)}</span>
              </button>

              <span className="dz-layer-acts">
                <Button
                  label={el.visible ? '👁' : '🚫'}
                  title={el.visible ? 'Sembunyikan' : 'Tampilkan'}
                  onClick={() => onPatch(el.id, { visible: !el.visible })}
                />
                <Button
                  label={el.locked ? '🔒' : '🔓'}
                  title={el.locked ? 'Buka kunci' : 'Kunci'}
                  onClick={() => onPatch(el.id, { locked: !el.locked })}
                />
                <Button
                  label="↑"
                  title="Majukan"
                  disabled={index === total - 1}
                  onClick={() => onReorder(el.id, index + 1)}
                />
                <Button
                  label="↓"
                  title="Mundurkan"
                  disabled={index === 0}
                  onClick={() => onReorder(el.id, index - 1)}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
