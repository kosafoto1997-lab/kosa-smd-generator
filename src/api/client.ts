/**
 * client.ts — Satu-satunya tempat di aplikasi ini yang memanggil fetch.
 *
 * Kenapa terpusat: kalau backend suatu saat pindah dari Apps Script ke tempat
 * lain, hanya file ini yang berubah. Seluruh UI tidak tersentuh.
 *
 * JANGAN memanggil fetch dari komponen. Lihat docs/PANDUAN-PENGEMBANGAN.md.
 */

/** Bentuk balasan backend. Selalu salah satu dari dua ini. */
type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Kegagalan yang datang dari backend, bukan dari jaringan. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly action: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Kegagalan jaringan, CORS, atau balasan yang tidak bisa diurai. */
export class NetworkError extends Error {
  constructor(
    message: string,
    readonly action: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

function config() {
  const url = import.meta.env.VITE_APPS_SCRIPT_URL;
  const token = import.meta.env.VITE_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      'VITE_APPS_SCRIPT_URL atau VITE_API_TOKEN belum diisi. ' +
        'Salin .env.example jadi .env lalu isi nilainya.',
    );
  }
  return { url, token };
}

/**
 * Panggil satu action di backend.
 *
 * Tiga hal di bawah ini WAJIB dan mudah salah:
 *
 * 1. `Content-Type: text/plain` — bukan application/json. Apps Script tidak
 *    bisa menjawab preflight OPTIONS, jadi application/json akan diblokir
 *    browser tanpa pesan error yang jelas.
 * 2. Token di dalam body — header Authorization juga memicu preflight.
 * 3. `redirect: 'follow'` — Apps Script selalu membalas 302 ke
 *    script.googleusercontent.com sebelum memberi isi sebenarnya.
 *
 * @throws {ApiError} kalau backend membalas {ok: false}
 * @throws {NetworkError} kalau jaringan gagal atau balasan bukan JSON
 */
export async function call<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { url, token } = config();

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, token }),
      redirect: 'follow',
    });
  } catch (err) {
    throw new NetworkError(
      'Tidak bisa menghubungi server. Periksa koneksi internet.',
      action,
      err,
    );
  }

  if (!res.ok) {
    throw new NetworkError(`Server membalas HTTP ${res.status}.`, action);
  }

  const text = await res.text();

  let json: ApiResponse<T>;
  try {
    json = JSON.parse(text) as ApiResponse<T>;
  } catch {
    // Penyebab paling umum: deployment belum diperbarui, atau URL salah
    // sehingga yang kembali halaman login/error HTML.
    throw new NetworkError(
      'Balasan server bukan JSON. Kemungkinan deployment belum diperbarui ' +
        'atau URL-nya salah.',
      action,
    );
  }

  if (!json.ok) throw new ApiError(json.error, action);
  return json.data;
}

/**
 * Periksa apakah backend hidup dan token diterima.
 * Dipakai saat aplikasi dibuka untuk memberi pesan yang jelas kalau salah
 * konfigurasi.
 */
export function ping() {
  return call<{ service: string; time: string }>('ping');
}
