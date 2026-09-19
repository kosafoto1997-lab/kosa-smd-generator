/**
 * driveUrl.ts — Utak-atik URL thumbnail Google Drive.
 *
 * Dipisahkan dari komponennya supaya bisa diuji tanpa memuat React: aturan
 * ukuran di bawah ini pernah membuat gambar tidak muncul sama sekali, jadi
 * layak dijaga tes.
 */

/**
 * Lebar maksimum yang diminta ke Drive.
 *
 * Drive menolak permintaan thumbnail yang terlalu besar dengan kesalahan,
 * bukan dengan gambar berukuran lebih kecil — meminta terlalu banyak justru
 * membuat gambarnya tidak muncul. Kanvas aslinya 1080 px, jadi 1000 sudah
 * hampir resolusi penuh sekaligus aman.
 */
export const MAX_THUMB_WIDTH = 1000;

/**
 * Naikkan parameter ukuran thumbnail Drive agar teks di dalam desain terbaca.
 *
 * URL non-Drive (misalnya data URL hasil render di browser) dikembalikan apa
 * adanya.
 */
export function bigger(src: string): string {
  return src.includes('drive.google.com/thumbnail')
    ? src.replace(/([?&])sz=w\d+/, `$1sz=w${MAX_THUMB_WIDTH}`)
    : src;
}
