/**
 * Identitas merek, dibaca dari sheet BRAND.
 *
 * Semua field opsional karena sheet bisa saja belum lengkap diisi. Renderer
 * wajib punya nilai bawaan untuk setiap field — merek yang belum diatur tidak
 * boleh membuat render gagal.
 */
export interface Brand {
  brandName?: string;
  igHandle?: string;
  website?: string;
  tagline?: string;

  primaryColor?: string;
  secondaryColor?: string;
  bgColor?: string;

  fontHeading?: string;
  fontBody?: string;

  tone?: string;
  audience?: string;
  visualStyle?: string;
  forbiddenWords?: string;

  /** File ID logo di Drive. Kosong berarti merek belum punya logo. */
  logoDriveId?: string;

  /**
   * Logo sebagai data URL, diisi saat render.
   *
   * Tidak pernah tersimpan di spreadsheet — hanya `logoDriveId` yang disimpan.
   * Renderer butuh bentuk data URL karena menggambar gambar lintas-domain ke
   * canvas membuatnya ter-taint dan `toDataURL()` sesudahnya gagal.
   */
  logoDataUrl?: string;
}

/**
 * Nilai bawaan kalau sheet BRAND belum diisi.
 * Warnanya sengaja netral-hangat supaya tetap layak tampil apa adanya.
 */
export const DEFAULT_BRAND = {
  brandName: 'Merek Ini',
  igHandle: '',
  primaryColor: '#C9A961',
  secondaryColor: '#2E3A45',
  bgColor: '#FAF7F2',
  fontHeading: 'Playfair Display',
  fontBody: 'Inter',
} as const satisfies Brand;

/** Ambil satu nilai brand dengan jaminan selalu ada isinya. */
export function brandValue<K extends keyof typeof DEFAULT_BRAND>(
  brand: Brand,
  key: K,
): string {
  const v = brand[key];
  return v !== undefined && v !== '' ? v : DEFAULT_BRAND[key];
}
