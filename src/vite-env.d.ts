/// <reference types="vite/client" />

/**
 * Variabel lingkungan yang dipakai aplikasi.
 * Ditegaskan tipenya supaya salah ketik tertangkap saat compile.
 */
interface ImportMetaEnv {
  /** URL web app Apps Script hasil deploy. */
  readonly VITE_APPS_SCRIPT_URL: string;
  /** Token bersama, harus sama dengan Script Property API_TOKEN. */
  readonly VITE_API_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
