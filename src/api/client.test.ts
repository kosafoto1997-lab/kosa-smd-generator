import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { call, ApiError, NetworkError } from './client';

/**
 * Tes ini menjaga tiga aturan CORS yang kalau dilanggar akan gagal secara
 * membingungkan di browser — tanpa pesan error yang jelas.
 */

const URL_UJI = 'https://script.google.com/macros/s/UJI/exec';
const TOKEN_UJI = 'token-uji';

beforeEach(() => {
  vi.stubEnv('VITE_APPS_SCRIPT_URL', URL_UJI);
  vi.stubEnv('VITE_API_TOKEN', TOKEN_UJI);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Pasang fetch tiruan yang membalas teks tertentu. */
function mockFetch(body: string, init: { ok?: boolean; status?: number } = {}) {
  const spy = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('aturan CORS Apps Script', () => {
  it('memakai Content-Type text/plain, bukan application/json', async () => {
    const spy = mockFetch(JSON.stringify({ ok: true, data: {} }));
    await call('ping');

    const init = spy.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect(headers['Content-Type']).toContain('text/plain');
    expect(headers['Content-Type']).not.toContain('application/json');
  });

  it('tidak mengirim header Authorization', async () => {
    const spy = mockFetch(JSON.stringify({ ok: true, data: {} }));
    await call('ping');

    const init = spy.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    // Header Authorization memicu preflight yang tidak bisa dijawab.
    expect(headers['Authorization']).toBeUndefined();
  });

  it('mengikuti redirect', async () => {
    const spy = mockFetch(JSON.stringify({ ok: true, data: {} }));
    await call('ping');

    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(init.redirect).toBe('follow');
  });

  it('mengirim token di dalam body', async () => {
    const spy = mockFetch(JSON.stringify({ ok: true, data: {} }));
    await call('ping');

    const init = spy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);

    expect(body.token).toBe(TOKEN_UJI);
    expect(body.action).toBe('ping');
  });
});

describe('bentuk permintaan', () => {
  it('membungkus payload dalam field payload', async () => {
    const spy = mockFetch(JSON.stringify({ ok: true, data: {} }));
    await call('listContent', { filter: { status: 'ready' } });

    const init = spy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);

    expect(body.payload).toEqual({ filter: { status: 'ready' } });
  });

  it('payload kosong tetap dikirim sebagai objek', async () => {
    const spy = mockFetch(JSON.stringify({ ok: true, data: {} }));
    await call('bootstrap');

    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string).payload).toEqual({});
  });
});

describe('penanganan balasan', () => {
  it('membuka bungkus {ok, data}', async () => {
    mockFetch(JSON.stringify({ ok: true, data: { topic: 'contoh' } }));
    const hasil = await call<{ topic: string }>('getContent');
    expect(hasil).toEqual({ topic: 'contoh' });
  });

  it('melempar ApiError kalau backend membalas ok:false', async () => {
    mockFetch(JSON.stringify({ ok: false, error: 'Token tidak sah.' }));
    await expect(call('ping')).rejects.toThrow(ApiError);
    await expect(call('ping')).rejects.toThrow('Token tidak sah.');
  });

  it('ApiError mencatat action yang gagal', async () => {
    mockFetch(JSON.stringify({ ok: false, error: 'gagal' }));
    await expect(call('listContent')).rejects.toMatchObject({
      action: 'listContent',
    });
  });

  it('balasan HTML dilaporkan sebagai NetworkError yang menuntun', async () => {
    // Terjadi kalau deployment belum diperbarui atau URL salah.
    mockFetch('<!DOCTYPE html><html>Google login</html>');
    await expect(call('ping')).rejects.toThrow(NetworkError);
    await expect(call('ping')).rejects.toThrow(/bukan JSON/);
  });

  it('HTTP non-200 dilaporkan sebagai NetworkError', async () => {
    mockFetch('', { ok: false, status: 500 });
    await expect(call('ping')).rejects.toThrow(/HTTP 500/);
  });

  it('kegagalan jaringan dilaporkan dengan pesan bahasa Indonesia', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('failed')));
    await expect(call('ping')).rejects.toThrow(/koneksi internet/);
  });
});

describe('konfigurasi', () => {
  it('memberi pesan jelas kalau env belum diisi', async () => {
    vi.stubEnv('VITE_APPS_SCRIPT_URL', '');
    await expect(call('ping')).rejects.toThrow(/\.env\.example/);
  });
});
