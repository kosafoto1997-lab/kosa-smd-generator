/**
 * Rasio pilar adalah inti strategi soft-selling: 45% edukasi menjaga akun
 * tetap layak diikuti, 10% soft product menjaganya tetap menjual. Pembagian
 * yang meleset merusak strategi itu tanpa gejala yang terlihat — kontennya
 * tetap terbit, hanya komposisinya yang diam-diam salah.
 */
import { describe, it, expect } from 'vitest';
import { describePlan, planBatch, type PillarWeight } from './planBatch';

/** Bobot bawaan proyek ini. */
const PILLARS: PillarWeight[] = [
  { id: 'edukasi', name: 'Edukasi', weight: 45 },
  { id: 'inspirasi', name: 'Inspirasi', weight: 25 },
  { id: 'relatable', name: 'Relatable', weight: 20 },
  { id: 'soft', name: 'Soft Product', weight: 10 },
];

/** Hitung berapa slot per pilar. */
function tally(slots: ReturnType<typeof planBatch>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of slots) out[s.pillarId] = (out[s.pillarId] ?? 0) + 1;
  return out;
}

describe('planBatch — jumlah total', () => {
  it('menghasilkan tepat sebanyak yang diminta', () => {
    for (const n of [1, 3, 7, 10, 12, 20, 33]) {
      expect(planBatch(n, PILLARS)).toHaveLength(n);
    }
  });

  it('memberi nomor urut mulai dari 1 tanpa lompat', () => {
    const slots = planBatch(9, PILLARS);
    expect(slots.map((s) => s.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('mengembalikan kosong untuk jumlah nol atau negatif', () => {
    expect(planBatch(0, PILLARS)).toEqual([]);
    expect(planBatch(-5, PILLARS)).toEqual([]);
  });

  it('membulatkan jumlah pecahan ke bawah', () => {
    expect(planBatch(4.9, PILLARS)).toHaveLength(4);
  });
});

describe('planBatch — kesetiaan pada bobot', () => {
  it('membagi 20 konten persis sesuai rasio', () => {
    // 45/25/20/10 dari 20 = 9/5/4/2, semuanya bulat.
    expect(tally(planBatch(20, PILLARS))).toEqual({
      edukasi: 9,
      inspirasi: 5,
      relatable: 4,
      soft: 2,
    });
  });

  it('memakai sisa terbesar saat pembagian tidak bulat', () => {
    // 45/25/20/10 dari 10 = 4,5/2,5/2/1. Jatah bulat 4+2+2+1 = 9, satu slot
    // tersisa jatuh ke pecahan terbesar (edukasi 0,5).
    const t = tally(planBatch(10, PILLARS));
    expect(t['edukasi']).toBe(5);
    expect(t['inspirasi']).toBe(2);
    expect(t['relatable']).toBe(2);
    expect(t['soft']).toBe(1);
  });

  it('memberi jatah pertama ke pilar berbobot terbesar', () => {
    const slots = planBatch(1, PILLARS);
    expect(slots[0]?.pillarId).toBe('edukasi');
  });

  it('tidak pernah memberi slot ke pilar berbobot nol', () => {
    const withZero: PillarWeight[] = [
      ...PILLARS,
      { id: 'mati', name: 'Nonaktif', weight: 0 },
    ];
    const ids = planBatch(20, withZero).map((s) => s.pillarId);
    expect(ids).not.toContain('mati');
  });
});

describe('planBatch — urutan diselang-seling', () => {
  it('tidak menumpuk semua edukasi di depan', () => {
    // Mengerjakan sepilar berturut-turut membuat AI mengulang sudut pandang,
    // dan pekerjaan yang terhenti di tengah jadi timpang komposisinya.
    const first4 = planBatch(20, PILLARS).slice(0, 4).map((s) => s.pillarId);
    expect(new Set(first4).size).toBeGreaterThan(1);
  });

  it('separuh pertama sudah mewakili beberapa pilar', () => {
    const half = planBatch(12, PILLARS).slice(0, 6);
    expect(new Set(half.map((s) => s.pillarId)).size).toBeGreaterThanOrEqual(3);
  });
});

describe('planBatch — masukan yang tidak wajar', () => {
  it('mengembalikan kosong kalau tidak ada pilar', () => {
    expect(planBatch(5, [])).toEqual([]);
  });

  it('mengembalikan kosong kalau semua bobot nol', () => {
    expect(
      planBatch(5, [{ id: 'a', name: 'A', weight: 0 }]),
    ).toEqual([]);
  });

  it('bekerja dengan satu pilar saja', () => {
    const slots = planBatch(3, [{ id: 'a', name: 'A', weight: 100 }]);
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s.pillarId === 'a')).toBe(true);
  });

  it('mengabaikan bobot negatif', () => {
    const ids = planBatch(
      10,
      [...PILLARS, { id: 'aneh', name: 'Aneh', weight: -50 }],
    ).map((s) => s.pillarId);
    expect(ids).not.toContain('aneh');
  });
});

describe('describePlan', () => {
  it('meringkas rencana dengan yang terbanyak di depan', () => {
    expect(describePlan(planBatch(20, PILLARS))).toBe(
      '9 edukasi · 5 inspirasi · 4 relatable · 2 soft product',
    );
  });

  it('mengembalikan teks kosong untuk rencana kosong', () => {
    expect(describePlan([])).toBe('');
  });
});
