/**
 * api — Semua pemanggilan backend.
 *
 * Komponen TIDAK boleh memanggil fetch langsung; selalu lewat sini.
 * Lihat docs/PANDUAN-PENGEMBANGAN.md bagian 4.
 */
import { call } from './client';
import * as m from './mappers';
import type { Brand } from '@/types/brand';
import type {
  ContentFilter,
  ContentSummary,
  Format,
  Status,
} from '@/types/content';
import type {
  Bootstrap,
  Calendar,
  ContentDetail,
  FetchedImage,
  GeneratedText,
  Hashtag,
  Idea,
  ProviderTestResult,
  UploadedFile,
} from '@/types/api';
import type { ProviderStatus } from '@/types/provider';
import type { DesignOverrides } from '@/types/design';

type Row = Record<string, unknown>;

export { call, ping, ApiError, NetworkError } from './client';
export * from './mappers';

/* ------------------------------------------------- pengaturan & inisialisasi */

export async function getBootstrap(): Promise<Bootstrap> {
  return m.toBootstrap(await call<Row>('bootstrap'));
}

export function initDatabase() {
  return call<{ ok: boolean; created: string[]; message: string }>('initDatabase');
}

export function saveSettings(payload: {
  brand?: Brand;
  config?: Record<string, string>;
}) {
  return call<{ saved: boolean }>('saveSettings', {
    ...(payload.brand ? { brand: m.fromBrand(payload.brand) } : {}),
    ...(payload.config ? { config: payload.config } : {}),
  });
}

export async function getQuotaStatus(): Promise<ProviderStatus[]> {
  const r = await call<{ providers: Row[] }>('getQuotaStatus');
  return r.providers.map(m.toProviderStatus);
}

export function resetBreakers() {
  return call<{ ok: boolean; message: string }>('resetBreakers');
}

/**
 * Bagikan ulang gambar lama supaya pratinjau bisa tampil.
 *
 * URL thumbnail Drive butuh akses "siapa pun yang punya tautan". Berkas yang
 * tersimpan sebelum UI ini berjalan di luar Apps Script mungkin belum
 * dibagikan, sehingga yang kembali halaman login alih-alih gambar.
 */
export function shareAllImages() {
  return call<{ ok: boolean; message: string }>('shareAllImages');
}

export async function testProviders(
  kind: 'text' | 'image' | 'all',
): Promise<ProviderTestResult> {
  const r = await call<Row>('testProviders', { kind });
  return {
    drive: m.toProviderTest((r['drive'] ?? {}) as Row),
    text: Array.isArray(r['text']) ? (r['text'] as Row[]).map(m.toProviderTest) : [],
    image: Array.isArray(r['image']) ? (r['image'] as Row[]).map(m.toProviderTest) : [],
  };
}

/* ------------------------------------ produksi konten — empat langkah terpisah */

/** Langkah 1: naskah + caption + prompt gambar. */
export async function generateText(args: {
  format: Format;
  pillar: string;
  topic: string;
  count: number;
}): Promise<GeneratedText> {
  const r = await call<Row>('generateText', {
    format: args.format,
    pillar: args.pillar,
    topic: args.topic,
    opts: { count: args.count },
  });

  return {
    contentId: String(r['content_id'] ?? ''),
    pillar: String(r['pillar'] ?? args.pillar),
    spec: m.toSpec((r['spec'] ?? {}) as Row, args.format),
    attempts: Array.isArray(r['attempts'])
      ? (r['attempts'] as Row[]).map(m.toAttempt)
      : [],
    ...(Array.isArray(r['sanitized']) && r['sanitized'].length > 0
      ? { sanitized: r['sanitized'] as string[] }
      : {}),
  };
}

/** Langkah 2: ambil satu gambar lewat rantai fallback. */
export async function fetchImage(args: {
  prompt: string;
  contentId: string;
  index: number;
  format: Format;
}): Promise<FetchedImage> {
  const r = await call<Row>('fetchImage', args);
  return {
    provider: String(r['provider'] ?? 'local'),
    attempts: Array.isArray(r['attempts'])
      ? (r['attempts'] as Row[]).map(m.toAttempt)
      : [],
    dataUrl: (r['dataUrl'] as string | null) ?? null,
    rawFileId: String(r['rawFileId'] ?? ''),
  };
}

/** Langkah 3: simpan satu hasil render ke Drive. */
export function uploadRendered(args: {
  contentId: string;
  format: Format;
  index: number;
  base64: string;
}) {
  return call<UploadedFile>('uploadRendered', args);
}

/** Langkah 4: catat konten ke spreadsheet. */
export function saveContent(payload: Record<string, unknown>) {
  return call<{ ok: boolean; content_id: string }>('saveContent', payload);
}

/* ------------------------------------------------------------------- ide */

export async function generateIdeas(pillar: string, count: number) {
  const r = await call<Row>('generateIdeas', { pillar, count });
  return {
    ideas: Array.isArray(r['ideas']) ? (r['ideas'] as Row[]).map(m.toIdea) : [],
    provider: String(r['provider'] ?? ''),
  };
}

export async function listIdeas(pillar?: string): Promise<Idea[]> {
  const r = await call<Row[]>('listIdeas', pillar ? { pillar } : {});
  return r.map(m.toIdea);
}

/* ------------------------------------------------------- library & kalender */

export async function listContent(filter: ContentFilter = {}): Promise<ContentSummary[]> {
  const r = await call<Row[]>('listContent', { filter });
  return r.map(m.toContentSummary);
}

export async function getContent(contentId: string): Promise<ContentDetail> {
  return m.toContentDetail(await call<Row>('getContent', { contentId }));
}

export function updateContentStatus(contentId: string, status: Status) {
  return call<{ updated: boolean }>('updateContentStatus', { contentId, status });
}

/**
 * Hapus konten beserta gambarnya di Drive.
 *
 * Tidak bisa dibatalkan dari aplikasi — pemanggil WAJIB meminta konfirmasi
 * lebih dulu. Berkasnya dibuang ke tempat sampah Drive, jadi pemiliknya masih
 * bisa memulihkan lewat Drive selama 30 hari.
 */
export function deleteContent(contentId: string) {
  return call<{
    deleted: boolean;
    files: number;
    failedFiles: number;
    rows: number;
  }>('deleteContent', { contentId });
}

export function updateCaption(contentId: string, caption: string, hashtags?: string) {
  return call<{ updated: boolean }>('updateCaption', {
    contentId,
    caption,
    ...(hashtags !== undefined ? { hashtags } : {}),
  });
}

/** Perbarui judul dan isi satu halaman. */
export function updateSlideText(
  contentId: string,
  order: number,
  title: string,
  body: string,
) {
  return call<{ updated: boolean }>('updateSlideText', { contentId, order, title, body });
}

/* ------------------------------------------------------------------ logo */

/** Unggah logo merek; menggantikan yang lama kalau sudah ada. */
export function uploadLogo(base64: string, mimeType: string) {
  return call<{ fileId: string; url: string }>('uploadLogo', { base64, mimeType });
}

/** Logo sebagai data URL, siap digambar ke canvas. */
export function getLogo() {
  return call<{ dataUrl: string | null }>('getLogo');
}

export function removeLogo() {
  return call<{ removed: boolean }>('removeLogo');
}

/** Simpan penyetelan visual per konten. */
export function saveDesign(contentId: string, design: DesignOverrides) {
  return call<{ saved: boolean }>('saveDesign', { contentId, design });
}

export function schedulePublish(contentId: string, platform: string, datetime: string) {
  return call<{ scheduled: boolean }>('schedulePublish', {
    contentId,
    platform,
    datetime,
  });
}

export async function getCalendar(month: string): Promise<Calendar> {
  return m.toCalendar(await call<Row>('getCalendar', { month }));
}

/** Gambar mentah dari 99_Raw_AI, untuk render ulang tanpa memakai kuota AI. */
export function getRawImage(contentId: string, index: number) {
  return call<{ dataUrl: string | null; fileId: string }>('getRawImage', {
    contentId,
    index,
  });
}

/* --------------------------------------------------------------- hashtag */

export async function listHashtags(): Promise<Hashtag[]> {
  const r = await call<Row[]>('listHashtags');
  return r.map(m.toHashtag);
}

export function addHashtag(tag: string, pillar: string, tier: string) {
  return call<{ added: string }>('addHashtag', { tag, pillar, tier });
}

export function deleteHashtag(tag: string) {
  return call<{ deleted: number }>('deleteHashtag', { tag });
}
