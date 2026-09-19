import { useState } from 'react';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useTheme } from '@/hooks/useTheme';
import { ToastProvider } from '@/hooks/useToast';
import { TooltipHost } from '@/components/ui';
import { GeneratePage } from '@/features/generate';
import { LibraryPage } from '@/features/library';
import { CalendarPage } from '@/features/calendar';
import { SettingsPage } from '@/features/settings';
import { IdeasPanel } from '@/features/ideas';
import { HashtagPanel } from '@/features/hashtags';
import './App.css';

type Tab = 'generate' | 'library' | 'calendar' | 'settings';

/**
 * Ikon digambar sebagai SVG sebaris, bukan diambil dari pustaka ikon.
 *
 * Empat ikon tidak sepadan dengan satu dependensi lagi, dan SVG sebaris
 * mewarisi `currentColor` sehingga otomatis benar di kedua tema.
 */
const ICONS: Record<Tab, string> = {
  // pena
  generate: 'M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586',
  // tumpukan kartu
  library: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  // kalender
  calendar: 'M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z M3 10h18 M8 2v4 M16 2v4',
  // gerigi
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 3.6 1.65 1.65 0 0010 2.09V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'generate', label: 'Buat' },
  { id: 'library', label: 'Konten' },
  { id: 'calendar', label: 'Jadwal' },
  { id: 'settings', label: 'Atur' },
];

function Icon({ tab }: { tab: Tab }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[tab]} />
    </svg>
  );
}

export function App() {
  return (
    <ToastProvider>
      {/* Satu instans melayani seluruh ikon keterangan di semua halaman. */}
      <TooltipHost />
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>('generate');
  const { data, error } = useBootstrap();
  const { theme, toggle } = useTheme();

  const brandName = data?.brand['brand_name'] ?? 'Kosa SMD';

  return (
    <div className="app">
      {/*
        Di HP bilah ini hanya menampilkan identitas dan pengalih tema — navigasi
        turun ke bawah layar, dalam jangkauan jempol. Di layar lebar, bilah yang
        sama menjadi kepala kolom navigasi di kiri.
      */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="mark" aria-hidden="true">
            {brandName.slice(0, 1)}
          </span>
          <span className="topbar-text">
            <strong className="topbar-name">{brandName}</strong>
            {data?.stats && (
              <span className="topbar-sub">
                {data.stats.total} konten · {data.stats.ideasNew} ide siap
              </span>
            )}
            {error && <span className="topbar-sub bad">gagal memuat</span>}
          </span>
        </div>

        <button
          type="button"
          className="icon-btn theme-btn"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
          title={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

        {/* Navigasi versi layar lebar. Di HP disembunyikan CSS. */}
        <nav className="railnav" aria-label="Navigasi utama">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`railnav-item${tab === t.id ? ' railnav-on' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <Icon tab={t.id} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/*
        Panel lintas-fitur dirakit di sini lewat slot, bukan diimpor dari dalam
        fitur lain. Itu menjaga tiap fitur tetap berdiri sendiri.
      */}
      <main className="main">
        {/*
          Tab Buat disembunyikan lewat CSS, bukan dilepas dari pohon React.

          Membuat konten adalah pekerjaan panjang — beberapa menit untuk satu
          konten, belasan menit untuk sekaligus banyak. Orang wajar menengok
          tab lain sambil menunggu. Kalau komponennya dilepas, semua `useState`
          di dalamnya ikut terbuang: isian form, daftar langkah, dan hasil yang
          belum sempat disalin. Lebih buruk lagi, proses yang sedang berjalan
          tetap menghabiskan kuota AI di latar tapi kemajuannya tidak pernah
          sampai ke layar lagi.

          Tiga tab lain tetap dilepas seperti biasa: isinya data dari server
          yang di-cache react-query, jadi tidak ada yang hilang saat kembali.
        */}
        <div className="tabpane" hidden={tab !== 'generate'}>
          <GeneratePage ideasSlot={(fill) => <IdeasPanel onPick={fill} />} />
        </div>
        {tab === 'library' && <LibraryPage />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'settings' && <SettingsPage hashtagSlot={<HashtagPanel />} />}
      </main>

      {/* Navigasi versi HP: menetap di dasar layar, dalam jangkauan jempol. */}
      <nav className="tabbar" aria-label="Navigasi utama">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tabbar-item${tab === t.id ? ' tabbar-on' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <Icon tab={t.id} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
