import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrimeReactProvider } from 'primereact/api';
import { App } from './App';
// Urutan disengaja: tema PrimeReact lebih dulu, token aplikasi sesudahnya —
// yang terakhir dimuat yang menang saat spesifisitasnya sama.
import './styles/prime.css';
import './styles/global.css';

/**
 * Backend Apps Script bisa sangat lambat (300 ms sampai 200 detik saat
 * provider AI antre), jadi data dianggap segar cukup lama dan retry dibatasi
 * supaya kegagalan tidak berlipat menghabiskan kuota.
 *
 * `staleTime` lima menit, bukan tiga puluh detik.
 *
 * Tab Konten, Jadwal, dan Atur DILEPAS dari pohon React saat ditinggalkan
 * (lihat App.tsx), jadi cache inilah satu-satunya yang membuat kembali ke tab
 * terasa seketika. Tiga puluh detik jauh lebih pendek daripada waktu orang
 * menengok tab lain, sehingga hampir setiap perpindahan tab dulu berakhir
 * memanggil Apps Script lagi dari nol — menunggu berkali-kali untuk data yang
 * itu-itu juga.
 *
 * Konsekuensinya disengaja: perubahan yang diketik langsung di Google
 * Spreadsheet baru menyusul paling lama lima menit. Perubahan dari dalam
 * aplikasi tetap tampil seketika karena setiap mutasi memanggil
 * invalidateQueries.
 *
 * `gcTime` lebih panjang lagi: data basi yang masih tersimpan tetap berharga
 * karena bisa ditampilkan lebih dulu lewat placeholderData sementara yang baru
 * diambil di latar.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutasi menyentuh kuota AI — jangan pernah diulang otomatis.
      retry: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Elemen #root tidak ditemukan di index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* ripple dimatikan: gelombang pada tiap klik terasa asing di antara
          komponen lain yang tidak punya animasi serupa. */}
      <PrimeReactProvider value={{ ripple: false }}>
        <App />
      </PrimeReactProvider>
    </QueryClientProvider>
  </StrictMode>,
);
