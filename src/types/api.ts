/** Bentuk data yang dipertukarkan dengan backend. */
import type { Brand } from './brand';
import type { ContentSpec, ContentSummary, Format, Slide, Status } from './content';
import type { Attempt, ProviderStatus, ProviderTest } from './provider';

/** Satu pilar konten beserta bobotnya. */
export interface PillarInfo {
  id: string;
  name: string;
  /** Persentase target kemunculan. */
  weight: number;
  description: string;
}

/** Data awal yang dimuat saat aplikasi dibuka. */
export interface Bootstrap {
  /** False kalau tab spreadsheet belum dibuat. */
  initialized: boolean;
  missingTabs: string[];
  brand: Record<string, string>;
  config: Record<string, string>;
  pillars: PillarInfo[];
  providers: ProviderStatus[];
  stats?: {
    total: number;
    byStatus: Record<string, number>;
    byPillar: Record<string, number>;
    ideasNew: number;
  };
}

/** Hasil langkah 1: naskah + caption + prompt gambar. */
export interface GeneratedText {
  contentId: string;
  pillar: string;
  spec: ContentSpec;
  attempts: Attempt[];
  /** Kata terlarang yang dibersihkan otomatis dari caption. */
  sanitized?: string[];
}

/** Hasil langkah 2: satu gambar dari rantai fallback AI. */
export interface FetchedImage {
  provider: string;
  attempts: Attempt[];
  /** Null berarti semua provider gagal — pakai latar prosedural. */
  dataUrl: string | null;
  rawFileId: string;
}

/** Hasil langkah 3: berkas tersimpan di Drive. */
export interface UploadedFile {
  fileId: string;
  url: string;
  viewUrl: string;
}

/** Hasil tes koneksi semua provider. */
export interface ProviderTestResult {
  drive: ProviderTest;
  text: ProviderTest[];
  image: ProviderTest[];
}

/** Detail satu konten beserta halamannya. */
export interface ContentDetail {
  /** `notes` menyimpan penyetelan visual sebagai JSON; kosong berarti bawaan. */
  content: ContentSummary & { cta: string; imagePrompt?: string; notes?: string };
  slides: Array<{
    order: number;
    type: Slide['type'];
    title: string;
    body: string;
    driveFileId: string;
    thumb: string;
    url: string;
  }>;
}

/** Satu ide mentah dari bank ide. */
export interface Idea {
  id: string;
  pillar: string;
  topic: string;
  angle: string;
  hook: string;
}

/** Satu entri di kalender publikasi. */
export interface CalendarEntry {
  logId: string;
  contentId: string;
  platform: string;
  scheduledAt: string;
  status: string;
  pillar: string;
  format: Format;
  topic: string;
  thumb: string;
}

export interface Calendar {
  month: string;
  entries: CalendarEntry[];
  ready: Array<{ contentId: string; topic: string; pillar: string; format: Format }>;
}

/** Satu hashtag di bank. */
export interface Hashtag {
  tag: string;
  pillar: string;
  tier: string;
  lastUsedAt: string;
  useCount: number;
}

/** Perubahan yang disimpan dari tab Pengaturan. */
export interface SettingsPayload {
  brand?: Partial<Record<string, string>>;
  config?: Partial<Record<string, string>>;
}

export type { Brand, ContentSummary, Status };
