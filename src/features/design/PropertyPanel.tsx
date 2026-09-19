/**
 * PropertyPanel.tsx — Sifat elemen yang sedang dipilih.
 *
 * Isinya berubah menurut jenis elemen: teks punya font dan perataan, bentuk
 * punya warna isi dan garis. Yang sama-sama dimiliki — posisi, ukuran, putaran,
 * transparansi — selalu ditampilkan di bawah.
 */
import { Card, CheckBox, Field, Select, TextArea, TextInput } from '@/components/ui';
import { KNOWN_FONTS } from '@/types/fonts';
import type { CanvasElement } from '@/types/canvas';

interface Props {
  element: CanvasElement | null;
  onPatch: (id: string, changes: Partial<CanvasElement>, commit?: boolean) => void;
  onCommit: () => void;
}

/** Kolom angka yang menolak nilai bukan-angka tanpa merusak ketikan. */
function NumberRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field label={label}>
      <TextInput
        type="number"
        value={String(value)}
        onChange={(v) => {
          const n = Number(v);
          // NaN diabaikan: mengosongkan kolom sejenak saat mengetik ulang
          // angka tidak boleh melempar elemen ke posisi 0.
          if (!Number.isNaN(n)) onChange(n);
        }}
        {...(min !== undefined ? { min } : {})}
        {...(max !== undefined ? { max } : {})}
        {...(step !== undefined ? { step } : {})}
      />
    </Field>
  );
}

export function PropertyPanel({ element, onPatch, onCommit }: Props) {
  if (!element) {
    return (
      <Card title="Properti">
        <p className="dim small">Pilih satu elemen di kanvas untuk mengatur sifatnya.</p>
      </Card>
    );
  }

  const el = element;
  const set = (changes: Partial<CanvasElement>) => {
    onPatch(el.id, changes);
    onCommit();
  };

  return (
    <Card title="Properti">
      {el.type === 'text' && (
        <>
          <Field label="Isi teks">
            <TextArea value={el.text} onChange={(v) => set({ text: v } as Partial<CanvasElement>)} />
          </Field>

          <Field label="Font">
            <Select
              value={el.fontFamily}
              onChange={(v) => set({ fontFamily: v } as Partial<CanvasElement>)}
              options={KNOWN_FONTS.map((f) => ({ value: f, label: f }))}
            />
          </Field>

          <NumberRow
            label="Ukuran huruf"
            value={el.fontSize}
            min={8}
            max={400}
            onChange={(n) => set({ fontSize: n } as Partial<CanvasElement>)}
          />

          <Field label="Tebal">
            <Select
              value={String(el.fontWeight)}
              onChange={(v) => set({ fontWeight: Number(v) } as Partial<CanvasElement>)}
              options={[
                { value: '300', label: 'Tipis' },
                { value: '400', label: 'Normal' },
                { value: '600', label: 'Tebal' },
                { value: '700', label: 'Sangat tebal' },
              ]}
            />
          </Field>

          <Field label="Perataan">
            <Select
              value={el.align}
              onChange={(v) => set({ align: v } as Partial<CanvasElement>)}
              options={[
                { value: 'left', label: 'Kiri' },
                { value: 'center', label: 'Tengah' },
                { value: 'right', label: 'Kanan' },
              ]}
            />
          </Field>

          <Field label="Warna teks">
            <TextInput
              type="color"
              value={el.fill}
              onChange={(v) => set({ fill: v } as Partial<CanvasElement>)}
            />
          </Field>
        </>
      )}

      {el.type === 'shape' && (
        <>
          {el.shape !== 'line' && (
            <Field label="Warna isi">
              <TextInput
                type="color"
                value={el.fill === 'transparent' ? '#ffffff' : el.fill}
                onChange={(v) => set({ fill: v } as Partial<CanvasElement>)}
              />
            </Field>
          )}

          <Field label="Warna garis">
            <TextInput
              type="color"
              value={el.stroke === 'transparent' ? '#000000' : el.stroke}
              onChange={(v) => set({ stroke: v } as Partial<CanvasElement>)}
            />
          </Field>

          <NumberRow
            label="Tebal garis"
            value={el.strokeWidth}
            min={0}
            max={80}
            onChange={(n) => set({ strokeWidth: n } as Partial<CanvasElement>)}
          />

          {el.shape === 'rect' && (
            <NumberRow
              label="Sudut membulat"
              value={el.cornerRadius}
              min={0}
              max={400}
              onChange={(n) => set({ cornerRadius: n } as Partial<CanvasElement>)}
            />
          )}
        </>
      )}

      <div className="dz-grid2">
        <NumberRow label="X" value={el.x} onChange={(n) => set({ x: n })} />
        <NumberRow label="Y" value={el.y} onChange={(n) => set({ y: n })} />
        <NumberRow label="Lebar" value={el.width} min={8} onChange={(n) => set({ width: n })} />
        <NumberRow label="Tinggi" value={el.height} min={8} onChange={(n) => set({ height: n })} />
      </div>

      <NumberRow
        label="Putaran (derajat)"
        value={el.rotation}
        min={-180}
        max={180}
        onChange={(n) => set({ rotation: n })}
      />

      <NumberRow
        label="Transparansi (0–1)"
        value={el.opacity}
        min={0}
        max={1}
        step={0.05}
        onChange={(n) => set({ opacity: Math.max(0, Math.min(1, n)) })}
      />

      <CheckBox
        label="Kunci elemen"
        checked={el.locked}
        onChange={(v) => set({ locked: v })}
      />
    </Card>
  );
}
