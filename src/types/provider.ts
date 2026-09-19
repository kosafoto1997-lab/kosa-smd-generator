/**
 * Tipe yang berkaitan dengan rantai fallback AI.
 *
 * Prinsip penting: kegagalan satu provider BUKAN error aplikasi. Kuota habis
 * adalah kejadian normal yang sudah diantisipasi rancangan. Tampilkan
 * `Attempt[]` sebagai informasi, bukan sebagai peringatan merah.
 */

/** Provider gambar, urut sesuai rantai fallback bawaan. */
export type ImageProvider = 'gemini' | 'cloudflare' | 'together' | 'pollinations' | 'local';

/** Provider teks, urut sesuai rantai fallback bawaan. */
export type TextProvider = 'gemini' | 'groq' | 'openrouter' | 'cloudflare' | 'template';

export type Provider = ImageProvider | TextProvider;

/**
 * Catatan satu percobaan provider.
 *
 * `skipped: true` berarti provider tidak pernah dipanggil — kuota habis, key
 * kosong, atau sedang diistirahatkan circuit breaker. Itu justru penghematan,
 * bukan kegagalan.
 */
export interface Attempt {
  provider: Provider;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  note?: string;
  ms?: number;
}

/** Keadaan satu provider untuk chip status di UI. */
export type ProviderState =
  /** siap dipakai */
  | 'ok'
  /** mendekati batas harian */
  | 'warn'
  /** kuota habis atau sedang diistirahatkan */
  | 'blocked'
  /** API key belum diisi */
  | 'off';

export interface ProviderStatus {
  provider: Provider;
  kind: 'text' | 'image';
  state: ProviderState;
  available: boolean;
  reason: string;
  calls: number;
  success: number;
  failed: number;
  /** 0 berarti tidak dibatasi. */
  cap: number;
  lastError: string;
  lastCalledAt: string;
}

/** Hasil ping satu provider dari tab Pengaturan. */
export interface ProviderTest {
  provider: Provider | 'drive';
  ok: boolean;
  message: string;
  ms: number;
}
