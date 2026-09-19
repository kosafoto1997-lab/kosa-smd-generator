/**
 * LogoField.tsx — Unggah dan hapus logo merek.
 *
 * Logo menggantikan teks handle Instagram di kaki tiap halaman konten. Kalau
 * merek belum punya logo, teks handle tetap dipakai — jadi fitur ini murni
 * menambah, tidak pernah membuat konten lama kehilangan tandanya.
 *
 * Berkasnya diperkecil di browser sebelum dikirim. Apps Script membatasi
 * ukuran permintaan, dan logo 4000 px sama sekali tidak berguna untuk sesuatu
 * yang tergambar setinggi 44 px di kanvas.
 */
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getLogo, removeLogo, uploadLogo } from '@/api';
import { BOOTSTRAP_KEY, LOGO_KEY } from '@/hooks/useBootstrap';
import { useToast } from '@/hooks/useToast';
import { Button, ErrorBox, Field } from '@/components/ui';

/** Sisi terpanjang logo setelah diperkecil. */
const MAX_SIDE = 512;

/** Batas berkas yang diterima sebelum diperkecil. */
const MAX_BYTES = 8 * 1024 * 1024;

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Perkecil gambar dan kembalikan base64-nya.
 *
 * PNG dipertahankan sebagai PNG supaya latar transparan tidak berubah jadi
 * kotak hitam — logo hampir selalu perlu transparansi.
 */
async function shrink(file: File): Promise<{ base64: string; mimeType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Berkas ini tidak bisa dibaca sebagai gambar.'));
      el.src = url;
    });

    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error('Gambar tidak punya ukuran yang bisa dibaca.');
    }

    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Peramban ini tidak mendukung canvas.');
    ctx.drawImage(img, 0, 0, w, h);

    const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const mimeType = keepAlpha ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, 0.9);

    return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LogoField({ hasLogo }: { hasLogo: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Pratinjau dipegang lokal, bukan diambil dari bootstrap.
   *
   * Yang tersimpan di merek hanya id berkasnya; isi gambarnya perlu permintaan
   * tersendiri. Menyimpannya di sini membuat logo yang baru diunggah langsung
   * terlihat tanpa menunggu putaran pengambilan data berikutnya.
   */
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useMutation({
    mutationFn: getLogo,
    onSuccess: (r) => setPreview(r.dataUrl),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      shrink(file).then((r) => uploadLogo(r.base64, r.mimeType)),
    onSuccess: () => {
      toast.show('Logo tersimpan. Konten berikutnya akan memakainya.', 'ok');
      setError(null);
      void qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY });
      void qc.invalidateQueries({ queryKey: LOGO_KEY });
      load.mutate();
    },
    onError: (e: Error) => setError(e),
  });

  const remove = useMutation({
    mutationFn: removeLogo,
    onSuccess: () => {
      toast.show('Logo dilepas. Kaki halaman kembali memakai handle Instagram.', 'ok');
      setPreview(null);
      setError(null);
      void qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY });
      void qc.invalidateQueries({ queryKey: LOGO_KEY });
    },
    onError: (e: Error) => setError(e),
  });

  function pick(file: File | undefined) {
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      setError(new Error('Format tidak didukung. Pakai PNG, JPG, atau WebP.'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(new Error('Berkas terlalu besar. Maksimal 8 MB.'));
      return;
    }

    setError(null);
    upload.mutate(file);
  }

  const busy = upload.isPending || remove.isPending;

  return (
    <Field
      label="Logo"
      hint="Muncul di kaki tiap halaman, menggantikan teks handle. PNG dengan latar transparan paling rapi."
    >
      <div className="logo-field">
        <div className="logo-box">
          {preview ? (
            <img src={preview} alt="Logo merek" />
          ) : hasLogo ? (
            <Button
              kind="text"
              label={load.isPending ? 'Memuat…' : 'Lihat logo tersimpan'}
              onClick={() => load.mutate()}
              disabled={load.isPending}
            />
          ) : (
            <span className="dim small">belum ada logo</span>
          )}
        </div>

        <div className="logo-act">
          <Button
            label={upload.isPending ? 'Mengunggah…' : hasLogo ? 'Ganti logo' : 'Pilih berkas'}
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          />
          {hasLogo && (
            <Button
              kind="text"
              label="Hapus"
              onClick={() => remove.mutate()}
              disabled={busy}
            />
          )}
        </div>

        {/*
          Input berkas asli disembunyikan dan dipicu lewat tombol di atas:
          tampilannya tidak bisa diseragamkan antar peramban, sementara
          perilakunya justru yang paling ingin dipertahankan.
        */}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(',')}
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            // Dikosongkan supaya memilih berkas yang sama dua kali tetap memicu
            // perubahan — tanpa ini percobaan ulang setelah gagal tidak jalan.
            e.target.value = '';
          }}
        />
      </div>

      {error && <ErrorBox error={error} />}
    </Field>
  );
}
