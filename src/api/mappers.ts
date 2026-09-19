/**
 * mappers.ts — Menerjemahkan bentuk data backend ke bentuk yang dipakai UI.
 *
 * Backend memakai snake_case mengikuti nama kolom spreadsheet. UI memakai
 * camelCase. Penerjemahan sengaja dipusatkan di sini supaya bentuk spreadsheet
 * tidak pernah bocor ke komponen — itu yang membuat penggantian backend nanti
 * jadi pekerjaan backend murni.
 */
import type { Brand } from '@/types/brand';
import type {
  ContentSpec,
  ContentSummary,
  Format,
  Slide,
  Status,
} from '@/types/content';
import type { Attempt, ProviderStatus, ProviderTest } from '@/types/provider';
import type {
  Bootstrap,
  Calendar,
  CalendarEntry,
  ContentDetail,
  Hashtag,
  Idea,
  PillarInfo,
} from '@/types/api';

/** Baris mentah dari backend: kunci apa pun, nilai belum dipastikan tipenya. */
type Row = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* -------------------------------------------------------------------- brand */

/** Pasangan kunci sheet BRAND (snake_case) dengan field Brand (camelCase). */
const BRAND_KEYS: ReadonlyArray<readonly [keyof Brand, string]> = [
  ['brandName', 'brand_name'],
  ['igHandle', 'ig_handle'],
  ['website', 'website'],
  ['tagline', 'tagline'],
  ['primaryColor', 'primary_color'],
  ['secondaryColor', 'secondary_color'],
  ['bgColor', 'bg_color'],
  ['fontHeading', 'font_heading'],
  ['fontBody', 'font_body'],
  ['tone', 'tone'],
  ['audience', 'audience'],
  ['visualStyle', 'visual_style'],
  ['forbiddenWords', 'forbidden_words'],
];

/**
 * Hanya dibaca, tidak pernah ikut ditulis saat menyimpan pengaturan.
 *
 * Id logo diubah lewat rute unggah/hapus tersendiri. Kalau ia ikut di
 * `fromBrand`, menyimpan pengaturan akan menimpanya dengan nilai yang
 * kebetulan ada di form — termasuk string kosong, yang berarti logo hilang
 * tanpa ada yang memintanya.
 */
const BRAND_READONLY_KEYS: ReadonlyArray<readonly [keyof Brand, string]> = [
  ['logoDriveId', 'logo_drive_id'],
];

/**
 * Sheet BRAND memakai kunci snake_case.
 *
 * Field yang kosong sengaja tidak disertakan sama sekali (bukan diisi
 * undefined), supaya `brandValue()` bisa menerapkan nilai bawaannya.
 */
export function toBrand(raw: Record<string, string>): Brand {
  const out: Brand = {};
  for (const [field, key] of [...BRAND_KEYS, ...BRAND_READONLY_KEYS]) {
    const v = raw[key];
    if (v !== undefined && v !== '') out[field] = v;
  }
  return out;
}

/** Balikkan ke bentuk sheet saat menyimpan. */
export function fromBrand(brand: Brand): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, key] of BRAND_KEYS) {
    const v = brand[field];
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/* ----------------------------------------------------------------- provider */

export function toAttempt(r: Row): Attempt {
  const a: Attempt = {
    provider: str(r['provider']) as Attempt['provider'],
    ok: r['ok'] === true,
  };
  if (r['skipped'] === true) a.skipped = true;
  if (r['error']) a.error = str(r['error']);
  if (r['note']) a.note = str(r['note']);
  if (r['ms'] !== undefined) a.ms = num(r['ms']);
  return a;
}

export function toProviderStatus(r: Row): ProviderStatus {
  return {
    provider: str(r['provider']) as ProviderStatus['provider'],
    kind: str(r['kind']) === 'image' ? 'image' : 'text',
    state: str(r['state']) as ProviderStatus['state'],
    available: r['available'] === true,
    reason: str(r['reason']),
    calls: num(r['calls']),
    success: num(r['success']),
    failed: num(r['failed']),
    cap: num(r['cap']),
    lastError: str(r['lastError'] ?? r['last_error']),
    lastCalledAt: str(r['lastCalledAt'] ?? r['last_called_at']),
  };
}

export function toProviderTest(r: Row): ProviderTest {
  return {
    provider: str(r['provider']) as ProviderTest['provider'],
    ok: r['ok'] === true,
    message: str(r['message']),
    ms: num(r['ms']),
  };
}

/* ---------------------------------------------------------------- bootstrap */

export function toPillar(r: Row): PillarInfo {
  return {
    id: str(r['id']),
    name: str(r['name']),
    weight: num(r['weight']),
    description: str(r['description']),
  };
}

export function toBootstrap(r: Row): Bootstrap {
  const stats = r['stats'] as Row | undefined;

  return {
    initialized: r['initialized'] === true,
    missingTabs: Array.isArray(r['missingTabs']) ? (r['missingTabs'] as string[]) : [],
    brand: (r['brand'] ?? {}) as Record<string, string>,
    config: (r['config'] ?? {}) as Record<string, string>,
    pillars: Array.isArray(r['pillars']) ? (r['pillars'] as Row[]).map(toPillar) : [],
    providers: Array.isArray(r['providers'])
      ? (r['providers'] as Row[]).map(toProviderStatus)
      : [],
    ...(stats
      ? {
          stats: {
            total: num(stats['total']),
            byStatus: (stats['byStatus'] ?? {}) as Record<string, number>,
            byPillar: (stats['byPillar'] ?? {}) as Record<string, number>,
            ideasNew: num(stats['ideasNew']),
          },
        }
      : {}),
  };
}

/* ------------------------------------------------------------------ konten */

export function toContentSummary(r: Row): ContentSummary {
  return {
    contentId: str(r['content_id']),
    createdAt: str(r['created_at']),
    pillar: str(r['pillar']),
    format: str(r['format']) as Format,
    topic: str(r['topic']),
    hook: str(r['hook']),
    caption: str(r['caption']),
    hashtags: str(r['hashtags']),
    imageProvider: str(r['image_provider']),
    textProvider: str(r['text_provider']),
    driveFileId: str(r['drive_file_id']),
    driveUrl: str(r['drive_url']),
    thumb: str(r['thumb']),
    slideCount: num(r['slide_count']),
    status: (str(r['status']) || 'draft') as Status,
    scheduledAt: str(r['scheduled_at']),
  };
}

export function toContentDetail(r: Row): ContentDetail {
  const c = (r['content'] ?? {}) as Row;
  const slides = Array.isArray(r['slides']) ? (r['slides'] as Row[]) : [];

  return {
    content: {
      ...toContentSummary(c),
      cta: str(c['cta']),
      imagePrompt: str(c['image_prompt']),
      notes: str(c['notes']),
    },
    slides: slides.map((s) => ({
      order: num(s['order']),
      type: (str(s['type']) || 'content') as Slide['type'],
      title: str(s['title']),
      body: str(s['body']),
      driveFileId: str(s['drive_file_id']),
      thumb: str(s['thumb']),
      url: str(s['url']),
    })),
  };
}

/**
 * Naskah hasil AI.
 *
 * Backend mengembalikan bentuk yang berbeda per format; fungsi ini menyatukan
 * ke discriminated union supaya komponen tidak perlu menebak-nebak.
 */
export function toSpec(raw: Row, format: Format): ContentSpec {
  const base = {
    topic: str(raw['topic']),
    hook: str(raw['hook']),
    caption: str(raw['caption']),
    cta: str(raw['cta']),
    hashtags: Array.isArray(raw['hashtags']) ? (raw['hashtags'] as string[]) : [],
  };

  const onscreen = (raw['onscreen_text'] ?? {}) as Row;
  const onscreenText = {
    headline: str(onscreen['headline']),
    subline: str(onscreen['subline']),
  };

  if (format === 'carousel') {
    const slides = Array.isArray(raw['slides']) ? (raw['slides'] as Row[]) : [];
    return {
      ...base,
      format: 'carousel',
      slides: slides.map((s, i) => ({
        order: num(s['order']) || i + 1,
        type: (str(s['type']) || 'content') as Slide['type'],
        title: str(s['title']),
        body: str(s['body']),
        imagePrompt: str(s['image_prompt']),
      })),
    };
  }

  if (format === 'reels' || format === 'shorts') {
    const frames = Array.isArray(raw['frames']) ? (raw['frames'] as Row[]) : [];
    return {
      ...base,
      format,
      onscreenText,
      imagePrompt: str(raw['image_prompt']),
      frames: frames.map((f, i) => ({
        order: num(f['order']) || i + 1,
        onscreen: str(f['onscreen']),
        voiceover: str(f['voiceover']),
        durationSec: num(f['duration_sec']) || 3,
        imagePrompt: str(f['image_prompt']),
      })),
    };
  }

  return {
    ...base,
    format: format === 'feed' ? 'feed' : 'story',
    onscreenText,
    imagePrompt: str(raw['image_prompt']),
  };
}

/**
 * Balikkan spec ke bentuk snake_case yang dipahami backend.
 *
 * Wajib dipakai saat menyimpan: backend membaca `spec.image_prompt` dan
 * `slide.image_prompt`, bukan versi camelCase-nya. Tanpa ini prompt gambar
 * hilang diam-diam dari spreadsheet.
 */
export function fromSpec(spec: ContentSpec): Record<string, unknown> {
  const base: Record<string, unknown> = {
    topic: spec.topic,
    hook: spec.hook,
    caption: spec.caption,
    cta: spec.cta,
    hashtags: spec.hashtags,
  };

  if (spec.format === 'carousel') {
    return {
      ...base,
      slides: spec.slides.map((s) => ({
        order: s.order,
        type: s.type,
        title: s.title,
        body: s.body,
        image_prompt: s.imagePrompt,
      })),
    };
  }

  if (spec.format === 'reels' || spec.format === 'shorts') {
    return {
      ...base,
      onscreen_text: spec.onscreenText,
      image_prompt: spec.imagePrompt,
      frames: spec.frames.map((f) => ({
        order: f.order,
        onscreen: f.onscreen,
        voiceover: f.voiceover,
        duration_sec: f.durationSec,
        image_prompt: f.imagePrompt,
      })),
    };
  }

  return {
    ...base,
    onscreen_text: spec.onscreenText,
    image_prompt: spec.imagePrompt,
  };
}

/* ------------------------------------------------------------------- lain */

export function toIdea(r: Row): Idea {
  return {
    id: str(r['id']),
    pillar: str(r['pillar']),
    topic: str(r['topic']),
    angle: str(r['angle']),
    hook: str(r['hook']),
  };
}

export function toHashtag(r: Row): Hashtag {
  return {
    tag: str(r['tag']),
    pillar: str(r['pillar']),
    tier: str(r['tier']),
    lastUsedAt: str(r['last_used_at']),
    useCount: num(r['use_count']),
  };
}

export function toCalendarEntry(r: Row): CalendarEntry {
  return {
    logId: str(r['log_id']),
    contentId: str(r['content_id']),
    platform: str(r['platform']),
    scheduledAt: str(r['scheduled_at']),
    status: str(r['status']),
    pillar: str(r['pillar']),
    format: str(r['format']) as Format,
    topic: str(r['topic']),
    thumb: str(r['thumb']),
  };
}

export function toCalendar(r: Row): Calendar {
  const entries = Array.isArray(r['entries']) ? (r['entries'] as Row[]) : [];
  const ready = Array.isArray(r['ready']) ? (r['ready'] as Row[]) : [];

  return {
    month: str(r['month']),
    entries: entries.map(toCalendarEntry),
    ready: ready.map((x) => ({
      contentId: str(x['content_id']),
      topic: str(x['topic']),
      pillar: str(x['pillar']),
      format: str(x['format']) as Format,
    })),
  };
}
