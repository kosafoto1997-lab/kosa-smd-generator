// defineConfig diambil dari vitest, bukan vite, karena berkas ini juga memuat
// konfigurasi "test" — tipe bawaan vite tidak mengenal kunci itu.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    // Alias "@/" menunjuk ke src/ supaya impor tidak berisi ../../..
    alias: { '@': path.resolve(__dirname, './src') },
  },

  // base diisi lewat env supaya bisa dideploy ke GitHub Pages (yang menyajikan
  // dari subpath /nama-repo/) maupun ke root domain sendiri.
  base: process.env.VITE_BASE_PATH || '/',

  build: {
    outDir: 'dist',
    sourcemap: true,
  },

  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
