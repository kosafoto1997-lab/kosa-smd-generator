/**
 * queryKeys.ts — Satu-satunya tempat kunci cache react-query didefinisikan.
 *
 * Kenapa dipusatkan: react-query mencocokkan kunci berdasarkan AWALAN. Dulu
 * daftar konten memakai `['content', {}]` dan detail satu konten memakai
 * `['content', id]`, sehingga satu panggilan
 * `invalidateQueries({ queryKey: ['content'] })` membatalkan daftar DAN seluruh
 * detail yang pernah dibuka sekaligus. Akibatnya menyimpan caption satu konten
 * membuat setiap konten lain ikut basi, dan membukanya lagi berarti menunggu
 * Apps Script dari nol.
 *
 * Sekarang keduanya berdiri di cabang terpisah — `content` dan `content-detail`
 * — supaya bisa dibatalkan sendiri-sendiri. Pakai `CONTENT_ALL` hanya kalau
 * memang dua-duanya harus disegarkan.
 */

/** Daftar konten di tab Library. */
export const CONTENT_LIST_KEY = ['content'] as const;

/** Detail satu konten beserta halamannya. */
export function contentDetailKey(contentId: string) {
  return ['content-detail', contentId] as const;
}

/** Seluruh detail, tanpa menyentuh daftar. */
export const CONTENT_DETAIL_ALL = ['content-detail'] as const;

/**
 * Batalkan daftar dan seluruh detail sekaligus.
 *
 * Dipakai untuk perubahan yang benar-benar menyentuh keduanya: membuat konten
 * baru, menghapus konten, atau membagikan ulang seluruh gambar. Untuk
 * suntingan pada SATU konten, batalkan daftar dan detail konten itu saja.
 */
export const CONTENT_ALL = [CONTENT_LIST_KEY, CONTENT_DETAIL_ALL] as const;
