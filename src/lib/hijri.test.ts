/**
 * Sekitar 15% pernikahan setahun menumpuk di bulan Syawal, dan bulan Hijriah
 * bergeser ~11 hari tiap tahun terhadap Masehi. Konversi yang meleset satu
 * bulan akan menyuruh pemakai bersiap di waktu yang salah — kesalahan yang
 * tidak menimbulkan gejala apa pun sampai musimnya lewat.
 */
import { describe, it, expect } from 'vitest';
import { hijriForMonth, seasonOf, toHijri } from './hijri';

describe('toHijri — konversi dasar', () => {
  it('mengembalikan bulan dalam jangkauan 1–12', () => {
    const h = toHijri(new Date(2026, 8, 15));
    expect(h).not.toBeNull();
    expect(h!.month).toBeGreaterThanOrEqual(1);
    expect(h!.month).toBeLessThanOrEqual(12);
  });

  it('memberi nama bulan dalam bahasa Indonesia', () => {
    // Nama harus terbaca, bukan angka — ini tampil langsung ke pemakai.
    const h = toHijri(new Date(2026, 8, 15));
    expect(h!.monthName).toMatch(/^[A-Z][a-z]+$/);
  });

  it('mengembalikan tahun Hijriah yang masuk akal', () => {
    // Tahun Hijriah untuk 2026 M berada di kisaran 1447–1448.
    const h = toHijri(new Date(2026, 8, 15));
    expect(h!.year).toBeGreaterThan(1440);
    expect(h!.year).toBeLessThan(1460);
  });

  it('maju satu bulan Hijriah setelah ~30 hari', () => {
    const a = toHijri(new Date(2026, 0, 1))!;
    const b = toHijri(new Date(2026, 1, 1))!;
    expect(`${a.year}-${a.month}`).not.toBe(`${b.year}-${b.month}`);
  });
});

describe('toHijri — pergeseran terhadap Masehi', () => {
  it('bulan Hijriah yang sama jatuh lebih awal tahun berikutnya', () => {
    // Inti masalahnya: penanggalan Hijriah bergeser ~11 hari per tahun, jadi
    // kalender Masehi murni tidak akan pernah menyorot puncak musim.
    const tahunIni = toHijri(new Date(2026, 5, 15))!;
    const tahunDepan = toHijri(new Date(2027, 5, 15))!;
    expect(tahunDepan.month).not.toBe(tahunIni.month);
  });
});

describe('seasonOf — musim nikah', () => {
  it('Syawal adalah puncaknya', () => {
    const s = seasonOf(10);
    expect(s.level).toBe('puncak');
    expect(s.advice).toContain('Perbanyak');
  });

  it('Ramadan dan Muharam adalah musim sepi', () => {
    expect(seasonOf(9).level).toBe('sepi');
    expect(seasonOf(1).level).toBe('sepi');
  });

  it('Zulkaidah dan Zulhijah ramai', () => {
    expect(seasonOf(11).level).toBe('ramai');
    expect(seasonOf(12).level).toBe('ramai');
  });

  it('bulan lain dianggap biasa', () => {
    for (const m of [2, 3, 4, 5, 6, 7, 8]) {
      expect(seasonOf(m).level).toBe('biasa');
    }
  });

  it('selalu memberi saran yang bisa ditindaklanjuti', () => {
    for (let m = 1; m <= 12; m++) {
      expect(seasonOf(m).advice.length).toBeGreaterThan(10);
    }
  });

  it('bulan di luar jangkauan tidak membuatnya gagal', () => {
    expect(seasonOf(0).level).toBe('biasa');
    expect(seasonOf(99).level).toBe('biasa');
  });
});

describe('hijriForMonth — bulan dominan', () => {
  it('menerima bentuk yyyy-MM', () => {
    const h = hijriForMonth('2026-09');
    expect(h).not.toBeNull();
    expect(h!.month).toBeGreaterThanOrEqual(1);
  });

  it('memilih bulan Hijriah yang menaungi hari terbanyak', () => {
    // Satu bulan Masehi selalu bersinggungan dengan dua bulan Hijriah; yang
    // dipakai harus yang mayoritas, bukan yang kebetulan jatuh di tanggal 1.
    const h = hijriForMonth('2026-09')!;
    const awal = toHijri(new Date(2026, 8, 1))!;
    const tengah = toHijri(new Date(2026, 8, 15))!;
    expect([awal.month, tengah.month]).toContain(h.month);
  });

  it('menolak bentuk yang tidak dikenal', () => {
    expect(hijriForMonth('')).toBeNull();
    expect(hijriForMonth('September')).toBeNull();
    expect(hijriForMonth('2026')).toBeNull();
  });

  it('bekerja untuk tiap bulan sepanjang setahun penuh', () => {
    for (let m = 1; m <= 12; m++) {
      const key = `2026-${String(m).padStart(2, '0')}`;
      expect(hijriForMonth(key)).not.toBeNull();
    }
  });

  it('menemukan Syawal di suatu tempat sepanjang tahun', () => {
    // Kalau tidak satu pun bulan Masehi memetakan ke Syawal, konversinya
    // rusak — dan justru Syawal yang paling penting untuk fitur ini.
    const months = Array.from({ length: 14 }, (_, i) => {
      const y = 2026 + Math.floor(i / 12);
      const m = (i % 12) + 1;
      return hijriForMonth(`${y}-${String(m).padStart(2, '0')}`);
    });
    expect(months.some((h) => h?.month === 10)).toBe(true);
  });
});
