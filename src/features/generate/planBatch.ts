/**
 * planBatch.ts — Bagi sejumlah konten ke dalam pilar sesuai bobotnya.
 *
 * Rasio pilar (45% edukasi, 25% inspirasi, 20% relatable, 10% soft product)
 * adalah inti strategi soft-selling. Membiarkan tiap konten memilih pilar
 * sendiri secara acak membuat rasio itu meleset jauh pada jumlah kecil —
 * sepuluh konten acak bisa saja menghasilkan enam soft product.
 *
 * Pembagian di sini memastikan komposisinya benar sejak awal, bukan berharap
 * rata-rata membetulkannya nanti.
 *
 * Modul murni — tanpa React, tanpa jaringan.
 */

export interface PillarWeight {
  id: string;
  name: string;
  weight: number;
}

export interface BatchSlot {
  /** Nomor urut, mulai dari 1. Dipakai untuk label kemajuan. */
  seq: number;
  pillarId: string;
  pillarName: string;
}

/**
 * Susun daftar tugas sebanyak `count`, terbagi menurut bobot pilar.
 *
 * Memakai metode sisa terbesar: tiap pilar mendapat jatah bulat lebih dulu,
 * lalu sisa slot diberikan ke pilar dengan pecahan terbesar. Pembulatan biasa
 * bisa menghasilkan total yang tidak sama dengan `count`.
 *
 * Hasilnya diselang-seling, bukan dikelompokkan: mengerjakan sepuluh konten
 * edukasi berturut-turut membuat AI mengulang sudut pandang yang mirip, dan
 * kalau pekerjaan dihentikan di tengah, yang tersimpan jadi timpang.
 */
export function planBatch(count: number, pillars: PillarWeight[]): BatchSlot[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];

  const usable = pillars.filter((p) => p.weight > 0);
  if (usable.length === 0) return [];

  const total = usable.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) return [];

  // Jatah bulat lebih dulu, sisanya dibagikan menurut pecahan terbesar.
  const shares = usable.map((p) => {
    const exact = (p.weight / total) * n;
    const base = Math.floor(exact);
    return { pillar: p, base, frac: exact - base };
  });

  let assigned = shares.reduce((sum, s) => sum + s.base, 0);

  const byFrac = [...shares].sort((a, b) => b.frac - a.frac);
  for (let i = 0; assigned < n; i++, assigned++) {
    const s = byFrac[i % byFrac.length];
    if (s) s.base++;
  }

  // Selang-seling: ambil satu per satu dari tiap pilar yang masih punya jatah,
  // dimulai dari yang bobotnya terbesar.
  const queues = shares
    .filter((s) => s.base > 0)
    .sort((a, b) => b.pillar.weight - a.pillar.weight)
    .map((s) => ({ pillar: s.pillar, left: s.base }));

  const out: BatchSlot[] = [];
  while (out.length < n) {
    let moved = false;

    for (const q of queues) {
      if (q.left === 0) continue;
      q.left--;
      moved = true;
      out.push({
        seq: out.length + 1,
        pillarId: q.pillar.id,
        pillarName: q.pillar.name,
      });
      if (out.length === n) break;
    }

    // Penjaga: tanpa ini, jatah yang habis lebih cepat dari perkiraan akan
    // membuat perulangan berjalan selamanya.
    if (!moved) break;
  }

  return out;
}

/** Ringkas rencana jadi "5 edukasi · 3 inspirasi · …" untuk ditampilkan. */
export function describePlan(slots: BatchSlot[]): string {
  const counts = new Map<string, number>();
  for (const s of slots) {
    counts.set(s.pillarName, (counts.get(s.pillarName) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${n} ${name.toLowerCase()}`)
    .join(' · ');
}
