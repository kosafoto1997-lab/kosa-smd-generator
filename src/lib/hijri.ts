/**
 * hijri.ts — Musim pernikahan menurut penanggalan Hijriah.
 *
 * Kenapa ini ada: sekitar 15% pernikahan di Indonesia sepanjang setahun
 * menumpuk di bulan **Syawal** saja. Bulan Hijriah bergeser sekitar 11 hari
 * setiap tahun terhadap penanggalan Masehi, jadi kalender yang hanya mengenal
 * Januari–Desember akan selalu meleset dari puncak musimnya.
 *
 * Bagi vendor undangan, memperbanyak konten menjelang Syawal jauh lebih
 * berpengaruh daripada menyebarkannya rata sepanjang tahun.
 *
 * Konversinya memakai `Intl.DateTimeFormat` dengan kalender `islamic-umalqura`
 * yang sudah tertanam di peramban — tidak ada tabel tanggal yang perlu dirawat
 * dan tidak ada pustaka tambahan. Penanggalan resmi Indonesia bisa berbeda
 * sehari karena rukyat, dan itu tidak jadi soal: yang dipakai di sini hanya
 * *bulan*-nya untuk menentukan musim, bukan tanggal pasti sebuah akad.
 *
 * Modul murni — tanpa React, tanpa jaringan.
 */

/** Nama bulan Hijriah, indeks 1–12. */
const MONTHS: Record<number, string> = {
  1: 'Muharam',
  2: 'Safar',
  3: 'Rabiulawal',
  4: 'Rabiulakhir',
  5: 'Jumadilawal',
  6: 'Jumadilakhir',
  7: 'Rajab',
  8: 'Syaban',
  9: 'Ramadan',
  10: 'Syawal',
  11: 'Zulkaidah',
  12: 'Zulhijah',
};

export interface HijriDate {
  /** 1–12. */
  month: number;
  year: number;
  monthName: string;
}

/** Seberapa ramai musim nikah pada bulan tertentu. */
export type Season = 'puncak' | 'ramai' | 'biasa' | 'sepi';

export interface SeasonInfo {
  level: Season;
  label: string;
  /** Saran tindakan, ditulis untuk pemakai non-teknis. */
  advice: string;
}

/**
 * Musim nikah per bulan Hijriah.
 *
 * Syawal adalah puncaknya sejauh ini; Zulhijah menyusul. Ramadan dan Muharam
 * justru palung — banyak keluarga menghindari menikah di kedua bulan itu.
 */
const SEASONS: Record<number, SeasonInfo> = {
  10: {
    level: 'puncak',
    label: 'Puncak musim nikah',
    advice: 'Bulan tersibuk sepanjang tahun. Perbanyak konten sekarang.',
  },
  12: {
    level: 'ramai',
    label: 'Musim ramai',
    advice: 'Banyak akad setelah musim haji. Jaga konten tetap rutin.',
  },
  11: {
    level: 'ramai',
    label: 'Musim ramai',
    advice: 'Persiapan menjelang Zulhijah. Waktu yang bagus untuk konten edukasi.',
  },
  9: {
    level: 'sepi',
    label: 'Musim sepi',
    advice: 'Jarang ada akad. Pas untuk menyiapkan stok konten menjelang Syawal.',
  },
  1: {
    level: 'sepi',
    label: 'Musim sepi',
    advice: 'Banyak yang menghindari menikah di bulan ini. Fokus ke konten edukasi.',
  },
};

const BIASA: SeasonInfo = {
  level: 'biasa',
  label: 'Musim biasa',
  advice: 'Jaga ritme posting seperti biasa.',
};

/**
 * Ubah tanggal Masehi jadi bulan Hijriah.
 *
 * Mengembalikan null kalau peramban tidak mendukung kalender Hijriah —
 * seluruh fitur musim lalu disembunyikan, bukan menampilkan tanggal keliru.
 */
export function toHijri(date: Date): HijriDate | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      month: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });

    const parts = fmt.formatToParts(date);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const year = Number(parts.find((p) => p.type === 'year')?.value);

    if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
    if (month < 1 || month > 12) return null;

    return { month, year, monthName: MONTHS[month] ?? String(month) };
  } catch {
    return null;
  }
}

/** Musim nikah untuk sebuah bulan Hijriah. */
export function seasonOf(hijriMonth: number): SeasonInfo {
  return SEASONS[hijriMonth] ?? BIASA;
}

/**
 * Bulan Hijriah yang paling banyak menaungi sebuah bulan Masehi.
 *
 * Satu bulan Masehi selalu bersinggungan dengan dua bulan Hijriah. Yang
 * dipakai adalah yang menaungi lebih banyak hari, karena itulah yang menentukan
 * suasana bulan tersebut bagi pemakai.
 *
 * @param month Bulan Masehi dalam bentuk `yyyy-MM`.
 */
export function hijriForMonth(month: string): HijriDate | null {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return null;

  const counts = new Map<string, { info: HijriDate; days: number }>();
  const daysInMonth = new Date(y, m, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const h = toHijri(new Date(y, m - 1, d));
    if (!h) return null;

    const key = `${h.year}-${h.month}`;
    const hit = counts.get(key);
    if (hit) hit.days++;
    else counts.set(key, { info: h, days: 1 });
  }

  let best: { info: HijriDate; days: number } | null = null;
  for (const v of counts.values()) {
    if (!best || v.days > best.days) best = v;
  }

  return best?.info ?? null;
}
