/**
 * download.ts — Menyimpan berkas ke perangkat pengguna.
 *
 * Tanpa ini, konten yang sudah dibuat tidak pernah benar-benar keluar dari
 * aplikasi: memposting ke Instagram menuntut berkasnya ada di galeri ponsel.
 *
 * Modul murni — tanpa React, tanpa `api/`.
 *
 * Tiga jebakan yang ditangani di sini, semuanya gagal DIAM-DIAM kalau
 * diabaikan (tidak ada error, unduhan sekadar tidak terjadi):
 *
 * 1. Membebaskan object URL terlalu cepat membatalkan unduhan di Safari iOS.
 * 2. Peramban dalam aplikasi Instagram dan WhatsApp membuang unduhan `blob:`
 *    tanpa pesan apa pun — dan pengguna di sini sering membuka tautan dari DM.
 * 3. Nama berkas dengan karakter terlarang ditolak diam-diam di Windows.
 */
import { downloadZip } from 'client-zip';

/**
 * Jeda sebelum object URL dibebaskan.
 *
 * Safari iOS membatalkan unduhan kalau URL-nya dicabut pada detak yang sama
 * dengan klik. Satu menit jauh lebih lama dari yang dibutuhkan peramban mana
 * pun, dan biayanya hanya sedikit memori sampai tab ditutup.
 */
const REVOKE_DELAY_MS = 60_000;

/**
 * Deteksi peramban dalam aplikasi yang diam-diam membuang unduhan.
 *
 * Sengaja memeriksa penanda aplikasi, bukan mesin peramban: yang bermasalah
 * adalah pembungkusnya, sedangkan Safari dan Chrome sungguhan baik-baik saja.
 */
export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\/|TikTok/i.test(ua);
}

/**
 * Bersihkan nama berkas.
 *
 * Karakter seperti `/` `:` `?` ditolak sistem berkas Windows dan Android, dan
 * kegagalannya tidak kelihatan — berkasnya sekadar tidak tersimpan. Topik
 * konten dipakai sebagai nama, jadi isinya bisa apa saja.
 */
export function safeName(raw: string, fallback = 'konten'): string {
  const clean = raw
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    // Dibersihkan SETELAH dipotong: pemotongan bisa mendarat tepat di tanda
    // hubung, dan nama berakhiran titik ditolak Windows.
    .replace(/^[-.]+|[-.]+$/g, '');

  return clean || fallback;
}

/** Picu unduhan dari sebuah Blob. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';

  // Harus berada di dalam dokumen agar klik terhitung di sebagian peramban.
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** Ubah data URL jadi Blob tanpa melewati jaringan. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);

  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const binary = atob(body);

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new Blob([bytes], { type: mime });
}

/** Simpan satu gambar dari data URL. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  saveBlob(dataUrlToBlob(dataUrl), filename);
}

/** Satu berkas yang akan masuk ke dalam arsip. */
export interface ZipEntry {
  name: string;
  /** Data URL gambar. */
  dataUrl: string;
}

/**
 * Simpan banyak gambar sekaligus sebagai satu berkas ZIP.
 *
 * Arsipnya disusun tanpa kompresi: JPEG sudah terkompresi, jadi memampatkannya
 * lagi hanya membuang waktu tanpa mengecilkan hasil.
 */
export async function downloadZipOf(
  entries: ZipEntry[],
  zipName: string,
): Promise<void> {
  const files = entries.map((e) => ({
    name: e.name,
    input: dataUrlToBlob(e.dataUrl),
  }));

  const blob = await downloadZip(files).blob();
  saveBlob(blob, zipName);
}

/** Salin teks ke papan klip, mengembalikan false kalau ditolak peramban. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
