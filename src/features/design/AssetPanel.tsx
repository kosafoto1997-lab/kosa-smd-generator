/**
 * AssetPanel.tsx — Pustaka aset: template teks, bentuk, dan gambar.
 *
 * Gambar unggahan disusutkan di browser sebelum dipakai. Foto ponsel 4000px
 * tidak menambah ketajaman apa pun pada kanvas 1080px, tapi memperlambat
 * seretan dan membengkakkan dokumen.
 */
import { useRef, useState } from 'react';
import { Button, Card, Field, TextInput } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import {
  CANVAS_PRESETS,
  makeImage,
  makeText,
  type CanvasDoc,
  type CanvasElement,
} from '@/types/canvas';
import type { Brand } from '@/types/brand';

/** Sisi terpanjang gambar setelah disusutkan. Dua kali lebar kanvas, cukup
 *  untuk diperbesar tanpa pecah. */
const MAX_SIDE = 2160;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/** Template teks siap pakai. Ukuran dalam piksel kanvas. */
const TEXT_TEMPLATES: Array<{ label: string; make: (w: number, h: number) => CanvasElement }> = [
  {
    label: 'Judul besar',
    make: (w, h) =>
      makeText(Math.round(w * 0.08), Math.round(h * 0.3), {
        text: 'Judul Utama',
        fontSize: 96,
        fontWeight: 700,
        fontFamily: 'Playfair Display',
        width: Math.round(w * 0.84),
      }),
  },
  {
    label: 'Sub judul',
    make: (w, h) =>
      makeText(Math.round(w * 0.08), Math.round(h * 0.45), {
        text: 'Penjelasan singkat di sini',
        fontSize: 48,
        fontWeight: 400,
        width: Math.round(w * 0.84),
      }),
  },
  {
    label: 'Isi paragraf',
    make: (w, h) =>
      makeText(Math.round(w * 0.08), Math.round(h * 0.55), {
        text: 'Tulis keterangan yang lebih panjang di bagian ini.',
        fontSize: 36,
        fontWeight: 300,
        lineHeight: 1.5,
        width: Math.round(w * 0.84),
      }),
  },
  {
    label: 'Kutipan',
    make: (w, h) =>
      makeText(Math.round(w * 0.12), Math.round(h * 0.4), {
        text: '"Kalimat yang ingin ditonjolkan"',
        fontSize: 56,
        fontWeight: 400,
        fontFamily: 'Playfair Display',
        align: 'center',
        width: Math.round(w * 0.76),
      }),
  },
  {
    label: 'Label kecil',
    make: (w, h) =>
      makeText(Math.round(w * 0.08), Math.round(h * 0.12), {
        text: 'KATEGORI',
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: 4,
        width: Math.round(w * 0.5),
      }),
  },
];

interface Props {
  doc: CanvasDoc;
  brand: Brand;
  onAdd: (el: CanvasElement) => void;
  onBackground: (color: string) => void;
}

export function AssetPanel({ doc, brand, onAdd, onBackground }: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const size = CANVAS_PRESETS[doc.preset];

  /**
   * Susutkan gambar lalu jadikan data URL.
   *
   * Data URL, bukan object URL: object URL mati begitu halaman ditutup, dan
   * dokumen yang disimpan akan menunjuk ke gambar yang sudah tidak ada.
   */
  function shrink(file: File): Promise<{ src: string; w: number; h: number }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));

          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          if (!ctx) throw new Error('Canvas tidak tersedia.');
          ctx.drawImage(img, 0, 0, w, h);

          // PNG dipertahankan supaya transparansi logo tidak jadi hitam.
          const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve({ src: c.toDataURL(type, 0.9), w, h });
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Berkas gambar tidak bisa dibaca.'));
      };
      img.src = url;
    });
  }

  async function addFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) {
        toast.show(`"${file.name}" bukan PNG, JPG, atau WebP.`, 'error');
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.show(`"${file.name}" lebih dari 8 MB.`, 'error');
        continue;
      }
      try {
        const { src, w, h } = await shrink(file);
        onAdd(makeImage(src, w, h, size.w, size.h, { name: file.name }));
      } catch (e) {
        toast.show(e instanceof Error ? e.message : 'Gagal memuat gambar.', 'error');
      }
    }
  }

  /** Logo merek dari tab Atur, kalau sudah diunggah. */
  function addLogo() {
    const src = brand.logoDataUrl;
    if (!src) {
      toast.show('Belum ada logo. Unggah dulu di tab Atur.', 'error');
      return;
    }
    const img = new Image();
    img.onload = () =>
      onAdd(makeImage(src, img.width, img.height, size.w, size.h, { name: 'Logo merek' }));
    img.onerror = () => toast.show('Logo tidak bisa dibaca.', 'error');
    img.src = src;
  }

  return (
    <>
      <Card title="Template teks">
        <div className="dz-assets">
          {TEXT_TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              className="dz-asset"
              onClick={() => onAdd(t.make(size.w, size.h))}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Gambar">
        {/*
          Zona seret-lepas. `onDragOver` wajib memanggil preventDefault, kalau
          tidak browser membuka berkasnya sebagai halaman baru dan pekerjaan
          yang belum disimpan hilang.
        */}
        <div
          className={`dz-drop${over ? ' dz-drop-on' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
          }}
        >
          Seret gambar ke sini, atau klik untuk memilih
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            // Dikosongkan supaya memilih berkas yang sama dua kali tetap memicu
            // onChange.
            e.target.value = '';
          }}
        />

        <div className="row-btn wrap">
          <Button label="Tambah logo merek" onClick={addLogo} />
        </div>
      </Card>

      <Card title="Latar">
        <Field label="Warna latar">
          <TextInput type="color" value={doc.background} onChange={onBackground} />
        </Field>
        <div className="dz-swatches">
          {[
            brand.bgColor ?? '#FAF7F2',
            brand.primaryColor ?? '#C9A961',
            brand.secondaryColor ?? '#2E3A45',
            '#FFFFFF',
            '#1C1C1C',
          ].map((c) => (
            <button
              key={c}
              type="button"
              className="dz-swatch"
              style={{ background: c }}
              title={c}
              onClick={() => onBackground(c)}
            />
          ))}
        </div>
      </Card>
    </>
  );
}
