/**
 * useTheme.ts — Pilihan tema terang/gelap.
 *
 * Bawaannya mengikuti setelan sistem, bukan dipaksa gelap: orang yang memakai
 * ponsel dalam mode terang di siang hari tidak sedang meminta antarmuka gelap.
 * Begitu memilih sendiri, pilihannya diingat dan setelan sistem tidak lagi
 * ikut campur.
 */
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'kosa-theme';

/** Baca pilihan tersimpan. Null berarti "belum pernah memilih". */
function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    // Mode penyamaran atau penyimpanan diblokir. Bukan alasan gagal.
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme());

  // Atribut inilah yang dibaca token di global.css.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Ikuti perubahan setelan sistem selama pengguna belum memilih sendiri.
  useEffect(() => {
    if (stored()) return;

    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return;

    const onChange = () => setTheme(systemTheme());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Tidak tersimpan hanya berarti pilihannya lupa saat halaman dimuat
        // ulang — temanya sendiri tetap berganti sekarang.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
