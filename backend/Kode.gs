/**
 * Kode.gs — SELURUH backend Kosa SMD Generator dalam satu berkas.
 *
 * Gabungan 11 modul yang dulu terpisah. Digabung supaya perbaikan cukup
 * menyentuh satu file: salin-tempel seluruh isi ini ke editor Apps Script,
 * tidak perlu mencocokkan nama berkas satu per satu.
 *
 * Backend ini MURNI API. Tidak ada doGet, tidak menyajikan HTML sama sekali.
 * Antarmukanya aplikasi React terpisah yang memanggil doPost di bagian 11.
 *
 * ── Cara mencari bagian ────────────────────────────────────────────────────
 * Tekan Ctrl+F lalu ketik penanda di bawah (termasuk "== "), misalnya "== 11".
 *
 *   == 1  KONFIGURASI    tetapan global, Config.secret(), Util
 *   == 2  SKEMA          definisi tab + data awal + initDatabase()
 *   == 3  SHEETDB        SATU-SATUNYA yang boleh menyentuh SpreadsheetApp
 *   == 4  KUOTA          hitungan pemakaian harian + circuit breaker
 *   == 5  PROMPT         penyusun prompt AI + validator soft-selling
 *   == 6  AI GAMBAR      rantai: gemini → cloudflare → pollinations → local
 *   == 7  AI TEKS        rantai: gemini → groq → openrouter → cloudflare → template
 *   == 8  DRIVE          penyimpanan gambar
 *   == 9  PIPELINE       perakit alur produksi konten
 *   == 10 FUNGSI API     seluruh fungsi api*, masing-masing dibungkus wrap_()
 *   == 11 ROUTER HTTP    doPost, pemeriksaan token, peta action
 *
 * ── URUTAN TIDAK BOLEH DIUBAH ──────────────────────────────────────────────
 * Tiap bagian adalah `const NamaModul = (function(){...})()`. JavaScript
 * mengeksekusinya berurutan dari atas, dan `const` tidak ter-hoist. Bagian 1
 * (Config) karena itu wajib paling atas — semua bagian lain memakainya.
 *
 * Aman karena tidak ada modul yang memanggil modul lain saat berkas dimuat;
 * seluruh pemanggilan silang terjadi di dalam badan fungsi, yang baru berjalan
 * setelah semua const terdefinisi. Jaga sifat itu kalau menambah kode:
 * JANGAN menulis `const X = Config.secret(...)` di tingkat atas berkas.
 *
 * ── Menambah action baru ───────────────────────────────────────────────────
 * 1. Tulis fungsi `apiNamaBaru()` di bagian 10, bungkus dengan wrap_().
 * 2. Daftarkan satu baris di API_ROUTES, bagian 11.
 * 3. Catat di docs/API.md.
 */



/**
 * == 1 KONFIGURASI    (dulu Config.gs)
 *
 * Konstanta global, pembacaan kredensial, dan utilitas kecil.
 *
 * Tidak ada satu pun API key yang ditulis di dalam kode.
 * Semua kredensial diambil dari PropertiesService.getScriptProperties().
 */

/** Nama semua tab di spreadsheet. */
const SHEETS = {
  CONFIG: 'CONFIG',
  BRAND: 'BRAND',
  PILLARS: 'PILLARS',
  PROMPT_TEMPLATES: 'PROMPT_TEMPLATES',
  IDEAS: 'IDEAS',
  CONTENT: 'CONTENT',
  SLIDES: 'SLIDES',
  API_USAGE: 'API_USAGE',
  PUBLISH_LOG: 'PUBLISH_LOG',
  HASHTAG_BANK: 'HASHTAG_BANK'
};

/** Format konten yang didukung. */
const FORMATS = {
  STORY: 'story',
  REELS: 'reels',
  SHORTS: 'shorts',
  CAROUSEL: 'carousel',
  FEED: 'feed'
};

/** Ukuran kanvas per format (piksel). */
const CANVAS_SIZE = {
  story:    { w: 1080, h: 1920 },
  reels:    { w: 1080, h: 1920 },
  shorts:   { w: 1080, h: 1920 },
  carousel: { w: 1080, h: 1350 },
  feed:     { w: 1080, h: 1350 }
};

/** Nama folder di Google Drive per format. */
const DRIVE_FOLDERS = {
  story:    '01_Story',
  reels:    '02_Reels',
  shorts:   '03_Shorts',
  carousel: '04_Carousel',
  feed:     '04_Carousel',
  raw:      '99_Raw_AI'
};

const TIMEZONE = 'Asia/Jakarta';

/** Status code yang layak di-retry sekali sebelum pindah provider. */
const HTTP_RETRY_CODES = [429, 500, 502, 503, 504];
const RETRY_DELAY_MS = 1500;

/** Circuit breaker: 3 gagal berturut-turut -> istirahat 15 menit. */
const BREAKER_FAIL_THRESHOLD = 3;
const BREAKER_COOLDOWN_SEC = 900;

/** Batas panjang prompt gambar; lebih dari ini sering diabaikan model. */
const AI_IMAGE_MAX_CHARS_PROMPT = 1400;

/**
 * Anggaran piksel untuk provider yang menerima ukuran bebas.
 *
 * Sekitar 1 megapiksel adalah titik seimbang: cukup tajam setelah diskalakan ke
 * kanvas 1080 px, dan masih selesai sebelum UrlFetchApp menyerah menunggu.
 * Pengukuran nyata pada Pollinations: ~1 MP butuh 35-45 detik, ~0,26 MP ~4 detik.
 */
const POLLINATIONS_PIXEL_BUDGET = 1050000;
const TOGETHER_PIXEL_BUDGET = 1050000;

/**
 * Jeda sebelum mencoba ulang Pollinations.
 *
 * Tier anonimnya hanya mengizinkan 1 permintaan berjalan per alamat IP, dan
 * Apps Script keluar lewat IP Google bersama, jadi 429 sering hanya soal antre.
 *
 * Dinaikkan ke 16 detik (September 2026): Pollinations kini membatasi tier
 * anonim menjadi satu permintaan per 15 detik. Jeda 5 detik yang lama membuat
 * carousel tujuh halaman menabrak batas itu berulang kali lalu menyerah ke
 * lapisan berikutnya, padahal permintaannya sendiri sah.
 */
const POLLINATIONS_RETRY_MS = 16000;

/**
 * Urutan fallback bawaan, dipakai kalau sheet CONFIG belum terbaca.
 * Nilai sebenarnya diambil dari CONFIG supaya bisa diubah tanpa menyentuh kode;
 * konstanta ini hanya jaring pengaman, dan sengaja didefinisikan satu kali saja.
 *
 * "together" tidak disertakan: endpoint gratisnya memang tidak menagih, tapi
 * Together mewajibkan kartu kredit sebelum API key bisa dibuat.
 */
const DEFAULT_IMAGE_ORDER = 'gemini,cloudflare,pollinations,local';
const DEFAULT_TEXT_ORDER = 'gemini,groq,openrouter,cloudflare,template';

/**
 * Akses kredensial & pengaturan.
 * Nilai sheet CONFIG di-memo per eksekusi supaya tidak membaca sheet berulang kali.
 */
const Config = (function () {
  let _settings = null;
  let _brand = null;

  /** @return {string} Nilai Script Property, string kosong kalau belum diisi. */
  function secret(key) {
    const v = PropertiesService.getScriptProperties().getProperty(key);
    return v ? String(v).trim() : '';
  }

  /** @return {boolean} True kalau semua key yang dibutuhkan provider sudah terisi. */
  function hasSecrets(keys) {
    return keys.every(function (k) { return secret(k) !== ''; });
  }

  /** @return {!Object<string,string>} Seluruh isi sheet CONFIG sebagai key/value. */
  function settings() {
    if (_settings) return _settings;
    try {
      _settings = SheetDB.kvAll(SHEETS.CONFIG);
    } catch (e) {
      _settings = {};
    }
    return _settings;
  }

  /** @return {string} Satu pengaturan dari sheet CONFIG. */
  function setting(key, fallback) {
    const all = settings();
    const v = all[key];
    return (v === undefined || v === null || v === '') ? fallback : String(v);
  }

  /** @return {number} Pengaturan numerik. */
  function num(key, fallback) {
    const n = Number(setting(key, fallback));
    return isNaN(n) ? fallback : n;
  }

  /** @return {!Array<string>} Pengaturan berupa daftar dipisah koma. */
  function list(key, fallback) {
    return String(setting(key, fallback))
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ''; });
  }

  /** @return {!Object<string,string>} Seluruh isi sheet BRAND. */
  function brand() {
    if (_brand) return _brand;
    try {
      _brand = SheetDB.kvAll(SHEETS.BRAND);
    } catch (e) {
      _brand = {};
    }
    return _brand;
  }

  /** Buang memo, dipakai setelah user menyimpan pengaturan dari UI. */
  function invalidate() {
    _settings = null;
    _brand = null;
  }

  return {
    secret: secret,
    hasSecrets: hasSecrets,
    setting: setting,
    num: num,
    list: list,
    brand: brand,
    settings: settings,
    invalidate: invalidate
  };
})();

/** Utilitas umum tanpa dependensi ke modul lain. */
const Util = (function () {

  /** @return {string} Tanggal hari ini di zona Asia/Jakarta, format yyyy-MM-dd. */
  function today() {
    return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  }

  /** @return {string} Bulan berjalan, format yyyy-MM. Dipakai untuk folder Drive. */
  function currentMonth() {
    return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM');
  }

  /** @return {string} Waktu sekarang, format yyyy-MM-dd HH:mm:ss. */
  function now() {
    return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }

  /** @return {string} ID konten unik, contoh: C20260912-7K3D. */
  function contentId() {
    const stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd');
    const rand = Utilities.getUuid().replace(/-/g, '').slice(0, 4).toUpperCase();
    return 'C' + stamp + '-' + rand;
  }

  /** @return {string} ID pendek berawalan huruf tertentu. */
  function shortId(prefix) {
    return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  /**
   * Parser JSON tahan banting untuk keluaran model bahasa.
   * Mencoba berurutan: parse langsung -> buang pagar markdown -> ambil blok kurung terluar.
   * @return {?Object} Null kalau benar-benar gagal.
   */
  function safeParseJson(text) {
    if (!text) return null;
    let raw = String(text).trim();

    try { return JSON.parse(raw); } catch (e) { /* lanjut */ }

    // Buang pagar markdown ```json ... ```
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try { return JSON.parse(fenced[1].trim()); } catch (e) { /* lanjut */ }
    }

    // Ambil dari kurung kurawal pertama sampai terakhir.
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first !== -1 && last > first) {
      const slice = raw.slice(first, last + 1);
      try { return JSON.parse(slice); } catch (e) { /* lanjut */ }
      // Coba sekali lagi setelah membersihkan koma menggantung.
      try { return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1')); } catch (e) { /* menyerah */ }
    }
    return null;
  }

  /** @return {string} Teks dipotong rapi di batas kata. */
  function truncate(text, maxChars) {
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    const cut = s.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
  }

  /** @return {!Array} Salinan array dalam urutan acak. */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** @return {*} Satu elemen acak. */
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Bersihkan tanda pagar dan spasi dari hashtag. */
  function normalizeTag(tag) {
    return String(tag || '').replace(/[#\s]/g, '').toLowerCase();
  }

  return {
    today: today,
    currentMonth: currentMonth,
    now: now,
    contentId: contentId,
    shortId: shortId,
    safeParseJson: safeParseJson,
    truncate: truncate,
    shuffle: shuffle,
    pick: pick,
    normalizeTag: normalizeTag
  };
})();


/**
 * == 2 SKEMA          (dulu Schema.gs)
 *
 * Definisi seluruh tab spreadsheet + data awal.
 *
 * initDatabase() bersifat idempotent: aman dijalankan berkali-kali,
 * tidak pernah menimpa data yang sudah ada.
 */

/** Definisi header tiap tab. */
const SCHEMA = {
  CONFIG: ['key', 'value', 'keterangan'],
  BRAND: ['key', 'value', 'keterangan'],
  PILLARS: ['pillar_id', 'name', 'weight', 'description', 'example_angles', 'visual_direction', 'active'],
  PROMPT_TEMPLATES: ['template_id', 'format', 'purpose', 'system_prompt', 'user_prompt', 'image_style_suffix', 'active'],
  IDEAS: ['idea_id', 'created_at', 'pillar', 'topic', 'angle', 'hook', 'status', 'used_in_content_id'],
  CONTENT: [
    'content_id', 'created_at', 'pillar', 'format', 'topic', 'hook', 'caption', 'hashtags', 'cta',
    'image_prompt', 'image_provider', 'text_provider', 'drive_file_id', 'drive_url',
    'slide_count', 'status', 'scheduled_at', 'notes'
  ],
  SLIDES: ['slide_id', 'content_id', 'order', 'slide_type', 'title', 'body', 'image_prompt', 'drive_file_id', 'drive_url'],
  API_USAGE: ['date', 'provider', 'kind', 'calls', 'success', 'failed', 'last_error', 'last_called_at'],
  PUBLISH_LOG: ['log_id', 'content_id', 'platform', 'scheduled_at', 'posted_at', 'status', 'link', 'notes'],
  HASHTAG_BANK: ['tag', 'pillar', 'tier', 'last_used_at', 'use_count']
};

/** Data awal sheet CONFIG. */
const SEED_CONFIG = [
  ['language', 'id', 'Bahasa keluaran AI'],
  ['carousel_slides_default', '7', 'Jumlah halaman carousel bawaan'],
  ['reels_frames_default', '4', 'Jumlah frame reels/shorts bawaan'],
  ['ratio_edukasi', '45', 'Target persentase pilar edukasi'],
  ['ratio_inspirasi', '25', 'Target persentase pilar inspirasi'],
  ['ratio_relatable', '20', 'Target persentase pilar relatable'],
  ['ratio_softproduct', '10', 'Target persentase pilar soft product'],
  ['hashtag_count', '5', 'Jumlah hashtag per caption. 3-5 disarankan sejak Instagram mengindeks kata di caption untuk pencarian; tumpukan tagar kini terbaca seperti spam'],
  ['image_provider_order', 'gemini,cloudflare,pollinations,local', 'Urutan fallback AI gambar. "together" sengaja tidak dipakai: butuh kartu kredit'],
  ['text_provider_order', 'gemini,groq,openrouter,cloudflare,template', 'Urutan fallback AI teks'],
  ['daily_cap_gemini_image', '80', 'Batas harian aman gambar Gemini'],
  ['daily_cap_cloudflare_image', '180', 'Batas harian aman gambar Cloudflare'],
  ['daily_cap_together_image', '50', 'Batas harian aman gambar Together (hanya kalau diaktifkan manual)'],
  ['daily_cap_pollinations_image', '200', 'Batas harian aman gambar Pollinations'],
  ['daily_cap_gemini_text', '400', 'Batas harian aman teks Gemini'],
  ['daily_cap_groq_text', '800', 'Batas harian aman teks Groq'],
  ['daily_cap_openrouter_text', '40', 'Batas harian aman teks OpenRouter'],
  ['daily_cap_cloudflare_text', '200', 'Batas harian aman teks Cloudflare'],
  ['pillar_balance_window', '30', 'Jumlah konten terakhir yang dipakai mengoreksi rasio pilar']
];

/** Data awal sheet BRAND. Silakan diubah lewat tab Pengaturan di aplikasi. */
const SEED_BRAND = [
  ['brand_name', 'Nikahku Digital', 'Nama merek'],
  ['ig_handle', '@nikahku.digital', 'Handle Instagram'],
  ['website', 'nikahku.id', 'Alamat situs'],
  ['tagline', 'Undangan digital, tanpa ribet', 'Tagline singkat'],
  ['primary_color', '#C9A961', 'Warna aksen utama'],
  ['secondary_color', '#2E3A45', 'Warna gelap untuk slide penutup'],
  ['bg_color', '#FAF7F2', 'Warna latar slide isi'],
  ['text_color', '#1C1C1C', 'Warna teks di atas latar terang'],
  ['font_heading', 'Playfair Display', 'Font judul (harus tersedia di Google Fonts)'],
  ['font_body', 'Inter', 'Font isi (harus tersedia di Google Fonts)'],
  ['tone', 'hangat, tenang, sedikit puitis, tidak lebay', 'Gaya bicara'],
  ['audience', 'calon pengantin 24-32 tahun, Indonesia, urban, budget menengah', 'Target pembaca'],
  ['forbidden_words', 'promo, diskon, buruan, order sekarang, DM aja, murah meriah, limited slot, harga spesial', 'Kata yang dilarang muncul di caption'],
  ['visual_style', 'editorial wedding photography, soft natural window light, warm neutral palette, champagne gold and cream tones, shallow depth of field, subtle film grain', 'Arah visual untuk prompt AI gambar'],
  ['logo_drive_id', '', 'File ID logo di Drive (opsional)']
];

/** Empat pilar konten. Bobot menentukan peluang terpilih pada mode Auto. */
const SEED_PILLARS = [
  [
    'edukasi', 'Edukasi', 45,
    'Informasi praktis yang benar-benar berguna untuk calon pengantin, terlepas dari apakah mereka membeli produk atau tidak.',
    'checklist persiapan | timeline 6 bulan | cara menyusun budget | etiket undangan | wording undangan yang sopan | adat dan tradisi | cara menghitung jumlah tamu | mengelola RSVP | kesalahan umum saat menyebar undangan',
    'flatlay undangan di atas meja kayu, buku catatan dan pena, kalender, detail kertas dan tinta, tangan sedang menulis',
    'ya'
  ],
  [
    'inspirasi', 'Inspirasi', 25,
    'Referensi visual dan ide estetik. Menjual suasana, bukan produk.',
    'tren warna tahun ini | gaya rustic vs modern | mood board pernikahan intimate | padu padan warna undangan | tema garden party | palet earth tone',
    'dekorasi pernikahan, bunga segar, kain dan tekstur, detail meja resepsi, cahaya sore, siluet',
    'ya'
  ],
  [
    'relatable', 'Relatable', 20,
    'Cerita dan perasaan yang dialami hampir semua calon pengantin. Tujuannya memancing komentar dan simpan.',
    'drama daftar tamu keluarga besar | POV: baru sadar tanggal mepet | perdebatan soal budget | rasanya H-30 | pertanyaan yang selalu ditanya om tante',
    'detail tangan bergandengan, sepatu pengantin, suasana rumah menjelang acara, potret dari belakang, momen tenang',
    'ya'
  ],
  [
    'softproduct', 'Soft Product', 10,
    'Produk hanya boleh muncul di kalimat terakhir sebagai solusi dari masalah yang sudah dibahas tuntas. Tidak boleh dimulai dari produk.',
    'kenapa undangan cetak sering kurang | repotnya melacak siapa yang sudah konfirmasi | mengirim undangan ke grup keluarga | undangan yang bisa diperbarui kalau tanggal berubah',
    'layar ponsel di atas meja dengan undangan terbuka, tangan memegang ponsel, suasana tenang, minimalis',
    'ya'
  ]
];

/**
 * Template prompt per format.
 * Placeholder yang tersedia: {{brand}} {{tone}} {{audience}} {{pillar}} {{pillar_desc}}
 * {{angles}} {{topic}} {{slides}} {{frames}} {{forbidden}} {{language}} {{visual_style}}
 */
const SEED_PROMPT_TEMPLATES = [
  [
    'tpl_story', 'story', 'Instagram Story satu gambar',
    'Kamu penulis konten media sosial untuk merek {{brand}}. Gaya bicara: {{tone}}. Pembaca: {{audience}}.',
    'Buat satu konten Instagram Story untuk pilar "{{pillar}}" ({{pillar_desc}}).\nTopik: {{topic}}\nContoh sudut pandang yang bisa dipakai: {{angles}}\n\nTeks di gambar harus sangat pendek karena akan ditimpa di atas foto. Caption 40-80 kata.',
    'vertical composition, clean negative space in the lower third for typography overlay',
    'ya'
  ],
  [
    'tpl_reels', 'reels', 'Facebook Reels / video pendek',
    'Kamu penulis skrip video pendek untuk merek {{brand}}. Gaya bicara: {{tone}}. Pembaca: {{audience}}.',
    'Buat naskah video pendek {{frames}} frame untuk pilar "{{pillar}}" ({{pillar_desc}}).\nTopik: {{topic}}\nSudut pandang: {{angles}}\n\nFrame 1 wajib berupa hook yang membuat orang berhenti scroll dalam 2 detik. Frame terakhir berisi penutup yang lembut. Setiap frame: teks layar maksimal 8 kata + satu kalimat voice over + durasi detik.',
    'vertical composition, cinematic, clean negative space in the center for typography overlay',
    'ya'
  ],
  [
    'tpl_shorts', 'shorts', 'YouTube Shorts',
    'Kamu penulis skrip video pendek untuk merek {{brand}}. Gaya bicara: {{tone}}. Pembaca: {{audience}}.',
    'Buat naskah YouTube Shorts {{frames}} frame untuk pilar "{{pillar}}" ({{pillar_desc}}).\nTopik: {{topic}}\nSudut pandang: {{angles}}\n\nPenonton YouTube lebih sabar sedikit dibanding Instagram, jadi boleh lebih informatif. Tetap hook di frame pertama.',
    'vertical composition, cinematic, clean negative space in the center for typography overlay',
    'ya'
  ],
  [
    'tpl_carousel', 'carousel', 'Carousel edukasi yang bisa digeser',
    'Kamu penulis konten edukasi media sosial untuk merek {{brand}}. Gaya bicara: {{tone}}. Pembaca: {{audience}}.',
    'Buat carousel {{slides}} halaman untuk pilar "{{pillar}}" ({{pillar_desc}}).\nTopik: {{topic}}\nSudut pandang: {{angles}}\n\nHalaman 1 bertipe "cover": judul yang bikin penasaran, maksimal 7 kata.\nHalaman 2 sampai {{slides}}-1 bertipe "content": satu poin per halaman, judul maksimal 6 kata, isi maksimal 30 kata. Setiap halaman harus berdiri sendiri dan benar-benar berisi.\nHalaman terakhir bertipe "closing": rangkuman singkat dan ajakan halus.\nCaption 120-220 kata.',
    'flatlay composition, top-down view, clean negative space, minimal props',
    'ya'
  ],
  [
    'tpl_feed', 'feed', 'Post feed gambar tunggal',
    'Kamu penulis konten media sosial untuk merek {{brand}}. Gaya bicara: {{tone}}. Pembaca: {{audience}}.',
    'Buat satu post feed untuk pilar "{{pillar}}" ({{pillar_desc}}).\nTopik: {{topic}}\nSudut pandang: {{angles}}\n\nCaption 120-220 kata, dibuka dengan hook yang kuat.',
    'editorial composition, clean negative space for typography overlay',
    'ya'
  ]
];

/** Bank hashtag awal: campuran tier besar, sedang, dan niche. */
const SEED_HASHTAGS = [
  // Umum
  ['weddingindonesia', 'all', 'big'], ['weddingorganizer', 'all', 'big'],
  ['weddingplanner', 'all', 'big'], ['weddingvendor', 'all', 'medium'],
  ['pernikahanimpian', 'all', 'niche'], ['jakartawedding', 'all', 'medium'],
  ['bandungwedding', 'all', 'niche'], ['surabayawedding', 'all', 'niche'],
  // Edukasi
  ['pernikahan', 'edukasi', 'big'], ['nikah', 'edukasi', 'big'],
  ['persiapanpernikahan', 'edukasi', 'medium'], ['tipsnikah', 'edukasi', 'medium'],
  ['tipspernikahan', 'edukasi', 'medium'], ['seserahan', 'edukasi', 'medium'],
  ['mahar', 'edukasi', 'medium'], ['akadnikah', 'edukasi', 'medium'],
  ['resepsipernikahan', 'edukasi', 'medium'], ['checklistpernikahan', 'edukasi', 'niche'],
  ['timelinepernikahan', 'edukasi', 'niche'], ['budgetpernikahan', 'edukasi', 'niche'],
  ['wordingundangan', 'edukasi', 'niche'], ['etiketundangan', 'edukasi', 'niche'],
  ['daftartamuundangan', 'edukasi', 'niche'], ['adatpernikahan', 'edukasi', 'niche'],
  ['rsvpdigital', 'edukasi', 'niche'], ['tipspersiapannikah', 'edukasi', 'niche'],
  // Inspirasi
  ['weddinginspiration', 'inspirasi', 'big'], ['weddingideas', 'inspirasi', 'big'],
  ['weddingdecor', 'inspirasi', 'big'], ['inspirasipernikahan', 'inspirasi', 'medium'],
  ['dekorasipernikahan', 'inspirasi', 'medium'], ['weddingtheme', 'inspirasi', 'medium'],
  ['rusticwedding', 'inspirasi', 'medium'], ['gardenwedding', 'inspirasi', 'medium'],
  ['intimatewedding', 'inspirasi', 'medium'], ['weddingstationery', 'inspirasi', 'medium'],
  ['weddingcolors', 'inspirasi', 'niche'], ['moodboardwedding', 'inspirasi', 'niche'],
  ['weddingflatlay', 'inspirasi', 'niche'], ['undangannikahestetik', 'inspirasi', 'niche'],
  // Relatable
  ['calonpengantin', 'relatable', 'big'], ['bridetobe', 'relatable', 'big'],
  ['prewedding', 'relatable', 'big'], ['weddingday', 'relatable', 'big'],
  ['menujuhalal', 'relatable', 'big'], ['groomtobe', 'relatable', 'medium'],
  ['katakatanikah', 'relatable', 'medium'], ['quotespernikahan', 'relatable', 'medium'],
  ['ceritanikah', 'relatable', 'niche'], ['dramanikah', 'relatable', 'niche'],
  ['povcalonpengantin', 'relatable', 'niche'], ['sebelumnikah', 'relatable', 'niche'],
  // Soft product
  ['undanganpernikahan', 'softproduct', 'big'], ['weddinginvitation', 'softproduct', 'big'],
  ['undangandigital', 'softproduct', 'medium'], ['undanganonline', 'softproduct', 'medium'],
  ['digitalinvitation', 'softproduct', 'medium'], ['weddinginvitationdesign', 'softproduct', 'medium'],
  ['undangannikahdigital', 'softproduct', 'niche'], ['undanganwebsite', 'softproduct', 'niche'],
  ['undanganvideo', 'softproduct', 'niche'], ['linkundangan', 'softproduct', 'niche'],
  ['undanganpernikahandigital', 'softproduct', 'niche']
];

/** Beberapa ide awal supaya aplikasi langsung bisa dicoba tanpa memanggil AI. */
const SEED_IDEAS = [
  ['edukasi', 'Timeline persiapan pernikahan 6 bulan', 'Dipecah per bulan, fokus ke hal yang sering terlewat', 'Enam bulan terasa lama sampai bulan ketiga'],
  ['edukasi', 'Kesalahan umum saat menulis wording undangan', 'Bahas nama orang tua, gelar, dan urutan penulisan', 'Satu huruf salah di nama, seumur hidup diingat'],
  ['edukasi', 'Cara menyusun daftar tamu tanpa menyinggung keluarga', 'Sistem tiga lapis: wajib, sebaiknya, kalau muat', 'Daftar tamu itu ujian diplomasi pertama'],
  ['inspirasi', 'Palet warna earth tone untuk pernikahan outdoor', 'Tiga kombinasi warna siap pakai', 'Warna yang tidak pernah salah difoto'],
  ['inspirasi', 'Gaya undangan: klasik, modern, atau minimalis', 'Bantu pembaca mengenali seleranya sendiri', 'Selera undangan biasanya mirip selera rumah'],
  ['relatable', 'POV: baru sadar tanggalnya tinggal 90 hari', 'Ditulis seperti catatan harian', 'Tenang, ini masih bisa dikejar'],
  ['relatable', 'Pertanyaan yang selalu muncul dari keluarga besar', 'Daftar pertanyaan dan cara menjawabnya dengan santai', 'Kapan nikah berubah jadi kapan acaranya'],
  ['softproduct', 'Repotnya melacak siapa yang sudah konfirmasi hadir', 'Bahas masalahnya dulu, solusi di kalimat terakhir', 'Sembilan puluh tamu, satu grup WhatsApp, nol kepastian']
];

/**
 * Buat semua tab, header, dan data awal. Aman dijalankan berulang kali.
 * @return {{ok: boolean, created: !Array<string>, message: string}}
 */
function initDatabase() {
  const created = [];
  const detail = [];

  Object.keys(SCHEMA).forEach(function (name) {
    const existed = !!SheetDB.sheet(name);
    SheetDB.ensureSheet(name, SCHEMA[name]);
    if (!existed) created.push(name);
  });

  // CONFIG dan BRAND: isi hanya key yang belum ada, jangan timpa nilai user.
  detail.push(seedKeyValue_(SHEETS.CONFIG, SEED_CONFIG) + ' baris CONFIG');
  detail.push(seedKeyValue_(SHEETS.BRAND, SEED_BRAND) + ' baris BRAND');

  // PILLARS
  if (SheetDB.countRows(SHEETS.PILLARS) === 0) {
    SheetDB.appendRows(SHEETS.PILLARS, SEED_PILLARS.map(function (r) {
      return {
        pillar_id: r[0], name: r[1], weight: r[2], description: r[3],
        example_angles: r[4], visual_direction: r[5], active: r[6]
      };
    }));
    detail.push(SEED_PILLARS.length + ' pilar');
  }

  // PROMPT_TEMPLATES
  if (SheetDB.countRows(SHEETS.PROMPT_TEMPLATES) === 0) {
    SheetDB.appendRows(SHEETS.PROMPT_TEMPLATES, SEED_PROMPT_TEMPLATES.map(function (r) {
      return {
        template_id: r[0], format: r[1], purpose: r[2],
        system_prompt: r[3], user_prompt: r[4], image_style_suffix: r[5], active: r[6]
      };
    }));
    detail.push(SEED_PROMPT_TEMPLATES.length + ' template prompt');
  }

  // HASHTAG_BANK
  if (SheetDB.countRows(SHEETS.HASHTAG_BANK) === 0) {
    SheetDB.appendRows(SHEETS.HASHTAG_BANK, SEED_HASHTAGS.map(function (r) {
      return { tag: r[0], pillar: r[1], tier: r[2], last_used_at: '', use_count: 0 };
    }));
    detail.push(SEED_HASHTAGS.length + ' hashtag');
  }

  // IDEAS
  if (SheetDB.countRows(SHEETS.IDEAS) === 0) {
    SheetDB.appendRows(SHEETS.IDEAS, SEED_IDEAS.map(function (r) {
      return {
        idea_id: Util.shortId('I'), created_at: Util.now(), pillar: r[0],
        topic: r[1], angle: r[2], hook: r[3], status: 'new', used_in_content_id: ''
      };
    }));
    detail.push(SEED_IDEAS.length + ' ide awal');
  }

  Config.invalidate();

  return {
    ok: true,
    created: created,
    message: created.length
      ? 'Tab baru dibuat: ' + created.join(', ') + '. Terisi: ' + detail.join(', ') + '.'
      : 'Semua tab sudah ada. ' + (detail.length ? 'Terisi: ' + detail.join(', ') + '.' : 'Tidak ada yang perlu diubah.')
  };
}

/**
 * Isi tab key/value hanya untuk key yang belum ada.
 * @return {number} Jumlah key baru yang ditambahkan.
 * @private
 */
function seedKeyValue_(sheetName, rows) {
  const existing = SheetDB.kvAll(sheetName);
  const missing = rows.filter(function (r) { return existing[r[0]] === undefined; });
  if (!missing.length) return 0;
  SheetDB.appendRows(sheetName, missing.map(function (r) {
    return { key: r[0], value: r[1], keterangan: r[2] };
  }));
  return missing.length;
}


/**
 * == 3 SHEETDB        (dulu SheetDB.gs)
 *
 * Satu-satunya lapisan yang boleh menyentuh SpreadsheetApp.
 *
 * Semua modul lain wajib lewat sini. Pembacaan selalu memakai
 * getDataRange().getValues() satu kali, tidak pernah getRange() di dalam loop.
 */
const SheetDB = (function () {

  let _ss = null;

  /** @return {!Spreadsheet} Spreadsheet aktif atau yang ditunjuk SPREADSHEET_ID. */
  function ss() {
    if (_ss) return _ss;
    const id = Config.secret('SPREADSHEET_ID');
    if (id) {
      _ss = SpreadsheetApp.openById(id);
    } else {
      _ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    if (!_ss) {
      throw new Error(
        'Spreadsheet tidak ditemukan. Isi Script Property "SPREADSHEET_ID" ' +
        'atau buka Apps Script lewat menu Ekstensi di spreadsheet-nya.'
      );
    }
    return _ss;
  }

  /** @return {?Sheet} Null kalau tab belum ada. */
  function sheet(name) {
    return ss().getSheetByName(name);
  }

  /** @return {!Sheet} Tab yang dijamin ada, dibuat beserta header kalau belum. */
  function ensureSheet(name, headers) {
    let sh = ss().getSheetByName(name);
    if (!sh) {
      sh = ss().insertSheet(name);
    }
    if (headers && headers.length) {
      const current = sh.getLastColumn() > 0
        ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
        : [];
      const needsHeader = current.length === 0 || String(current[0] || '').trim() === '';
      if (needsHeader) {
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);
        sh.getRange(1, 1, 1, headers.length)
          .setFontWeight('bold')
          .setBackground('#F1F3F4');
        sh.setFrozenRows(1);
      }
    }
    return sh;
  }

  /** @return {!Array<string>} Header baris pertama. */
  function headers(name) {
    const sh = sheet(name);
    if (!sh || sh.getLastColumn() === 0) return [];
    return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim(); });
  }

  /**
   * Baca seluruh baris data sebagai objek.
   * Setiap objek mendapat properti tambahan `_row` (nomor baris di sheet, 1-based).
   * @return {!Array<!Object>}
   */
  function getRows(name) {
    const sh = sheet(name);
    if (!sh) return [];
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return [];
    const head = values[0].map(function (h) { return String(h).trim(); });
    const out = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      // Lewati baris yang benar-benar kosong.
      if (row.every(function (c) { return c === '' || c === null; })) continue;
      const obj = { _row: i + 1 };
      for (let c = 0; c < head.length; c++) {
        if (!head[c]) continue;
        obj[head[c]] = row[c];
      }
      out.push(obj);
    }
    return out;
  }

  /** Tambah satu baris dari objek, mengikuti urutan header. */
  function appendRow(name, obj) {
    const sh = sheet(name);
    if (!sh) throw new Error('Tab "' + name + '" belum ada. Jalankan Inisialisasi Database dulu.');
    const head = headers(name);
    const row = head.map(function (h) {
      const v = obj[h];
      return (v === undefined || v === null) ? '' : v;
    });
    sh.appendRow(row);
    return sh.getLastRow();
  }

  /** Tambah banyak baris sekaligus (jauh lebih cepat daripada appendRow berulang). */
  function appendRows(name, objs) {
    if (!objs || !objs.length) return 0;
    const sh = sheet(name);
    if (!sh) throw new Error('Tab "' + name + '" belum ada.');
    const head = headers(name);
    const rows = objs.map(function (obj) {
      return head.map(function (h) {
        const v = obj[h];
        return (v === undefined || v === null) ? '' : v;
      });
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, head.length).setValues(rows);
    return rows.length;
  }

  /**
   * Perbarui baris pertama yang cocok. Hanya kolom di `patch` yang ditulis ulang.
   * @return {boolean} True kalau ada baris yang diperbarui.
   */
  function updateWhere(name, keyColumn, keyValue, patch) {
    const sh = sheet(name);
    if (!sh) return false;
    const head = headers(name);
    const keyIdx = head.indexOf(keyColumn);
    if (keyIdx === -1) return false;

    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][keyIdx]) !== String(keyValue)) continue;
      Object.keys(patch).forEach(function (k) {
        const c = head.indexOf(k);
        if (c === -1) return;
        const v = patch[k];
        sh.getRange(i + 1, c + 1).setValue(v === undefined || v === null ? '' : v);
      });
      return true;
    }
    return false;
  }

  /** Perbarui satu baris berdasarkan nomor barisnya (lebih murah dari updateWhere). */
  function updateRowAt(name, rowNumber, patch) {
    const sh = sheet(name);
    if (!sh) return false;
    const head = headers(name);
    Object.keys(patch).forEach(function (k) {
      const c = head.indexOf(k);
      if (c === -1) return;
      const v = patch[k];
      sh.getRange(rowNumber, c + 1).setValue(v === undefined || v === null ? '' : v);
    });
    return true;
  }

  /** Tulis baris kalau kunci sudah ada, kalau belum tambahkan baru. */
  function upsert(name, keyColumn, keyValue, obj) {
    const ok = updateWhere(name, keyColumn, keyValue, obj);
    if (!ok) appendRow(name, obj);
    return !ok; // true berarti baris baru
  }

  /** Hapus semua baris yang cocok. */
  function deleteWhere(name, keyColumn, keyValue) {
    const sh = sheet(name);
    if (!sh) return 0;
    const head = headers(name);
    const keyIdx = head.indexOf(keyColumn);
    if (keyIdx === -1) return 0;
    const values = sh.getDataRange().getValues();
    let deleted = 0;
    // Hapus dari bawah ke atas supaya nomor baris tidak bergeser.
    for (let i = values.length - 1; i >= 1; i--) {
      if (String(values[i][keyIdx]) === String(keyValue)) {
        sh.deleteRow(i + 1);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Baca tab bergaya key/value (kolom: key, value) jadi objek datar.
   * @return {!Object<string,string>}
   */
  function kvAll(name) {
    const sh = sheet(name);
    if (!sh) return {};
    const values = sh.getDataRange().getValues();
    const out = {};
    for (let i = 1; i < values.length; i++) {
      const k = String(values[i][0] || '').trim();
      if (!k) continue;
      out[k] = values[i][1];
    }
    return out;
  }

  /** Tulis satu pasangan key/value. */
  function kvSet(name, key, value) {
    const sh = ensureSheet(name, ['key', 'value', 'keterangan']);
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === key) {
        sh.getRange(i + 1, 2).setValue(value);
        return;
      }
    }
    sh.appendRow([key, value, '']);
  }

  /** Tulis banyak pasangan key/value sekaligus. */
  function kvSetMany(name, obj) {
    Object.keys(obj).forEach(function (k) { kvSet(name, k, obj[k]); });
  }

  /** Kosongkan data tapi pertahankan baris header. */
  function clearData(name) {
    const sh = sheet(name);
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(1, sh.getLastColumn())).clearContent();
  }

  /** @return {number} Jumlah baris data (tanpa header). */
  function countRows(name) {
    const sh = sheet(name);
    if (!sh) return 0;
    return Math.max(0, sh.getLastRow() - 1);
  }

  return {
    ss: ss,
    sheet: sheet,
    ensureSheet: ensureSheet,
    headers: headers,
    getRows: getRows,
    appendRow: appendRow,
    appendRows: appendRows,
    updateWhere: updateWhere,
    updateRowAt: updateRowAt,
    upsert: upsert,
    deleteWhere: deleteWhere,
    kvAll: kvAll,
    kvSet: kvSet,
    kvSetMany: kvSetMany,
    clearData: clearData,
    countRows: countRows
  };
})();


/**
 * == 4 KUOTA          (dulu Quota.gs)
 *
 * Pencatatan pemakaian provider AI + circuit breaker.
 *
 * Dua lapis pengaman:
 *   1. Batas harian (daily_cap_*) dibaca dari sheet CONFIG, dihitung dari sheet API_USAGE.
 *   2. Circuit breaker: 3 gagal berturut-turut -> provider diistirahatkan 15 menit.
 *
 * Kuota harian otomatis reset karena kunci barisnya memakai tanggal Asia/Jakarta.
 */
const Quota = (function () {

  /** Key yang dipakai untuk Script Properties -> Script Property per provider. */
  const PROVIDER_SECRETS = {
    gemini:      ['GEMINI_API_KEY'],
    cloudflare:  ['CF_ACCOUNT_ID', 'CF_API_TOKEN'],
    together:    ['TOGETHER_API_KEY'],
    openrouter:  ['OPENROUTER_API_KEY'],
    groq:        ['GROQ_API_KEY'],
    pollinations: [],  // tanpa API key
    local:       [],   // renderer prosedural, tanpa jaringan
    template:    []    // penyusun caption lokal
  };

  function breakerKey_(provider, kind) {
    return 'breaker:' + provider + ':' + kind;
  }

  function failKey_(provider, kind) {
    return 'fail:' + provider + ':' + kind;
  }

  /** @return {boolean} True kalau semua Script Property provider sudah terisi. */
  function hasCredentials(provider) {
    const keys = PROVIDER_SECRETS[provider];
    if (!keys) return false;
    if (keys.length === 0) return true;
    return Config.hasSecrets(keys);
  }

  /** @return {number} Jumlah panggilan hari ini untuk provider+kind. */
  function callsToday(provider, kind) {
    const rows = SheetDB.getRows(SHEETS.API_USAGE);
    const today = Util.today();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (String(r.date) === today && r.provider === provider && r.kind === kind) {
        return Number(r.calls) || 0;
      }
    }
    return 0;
  }

  /** @return {number} Batas harian dari CONFIG, 0 berarti tidak dibatasi. */
  function dailyCap(provider, kind) {
    return Config.num('daily_cap_' + provider + '_' + kind, 0);
  }

  /** @return {boolean} True kalau provider sedang diistirahatkan breaker. */
  function isTripped(provider, kind) {
    return CacheService.getScriptCache().get(breakerKey_(provider, kind)) !== null;
  }

  /**
   * Apakah provider layak dicoba sekarang?
   * @return {{available: boolean, reason: string}}
   */
  function check(provider, kind) {
    if (!PROVIDER_SECRETS.hasOwnProperty(provider)) {
      return { available: false, reason: 'provider tidak dikenal' };
    }
    if (!hasCredentials(provider)) {
      return { available: false, reason: 'API key belum diisi' };
    }
    if (isTripped(provider, kind)) {
      return { available: false, reason: 'sedang diistirahatkan (gagal beruntun)' };
    }
    const cap = dailyCap(provider, kind);
    if (cap > 0) {
      const used = callsToday(provider, kind);
      if (used >= cap) {
        return { available: false, reason: 'kuota harian habis (' + used + '/' + cap + ')' };
      }
    }
    return { available: true, reason: '' };
  }

  /** @return {boolean} Versi ringkas dari check(). */
  function isAvailable(provider, kind) {
    return check(provider, kind).available;
  }

  /**
   * Catat satu panggilan ke sheet API_USAGE dan perbarui status breaker.
   * Kegagalan pencatatan tidak boleh menghentikan alur utama.
   */
  function record(provider, kind, success, errorMessage) {
    const cache = CacheService.getScriptCache();
    const fk = failKey_(provider, kind);

    // Perbarui hitungan gagal beruntun lebih dulu (murah, tidak butuh lock).
    if (success) {
      cache.remove(fk);
    } else {
      const streak = Number(cache.get(fk) || 0) + 1;
      cache.put(fk, String(streak), BREAKER_COOLDOWN_SEC);
      if (streak >= BREAKER_FAIL_THRESHOLD) {
        cache.put(breakerKey_(provider, kind), '1', BREAKER_COOLDOWN_SEC);
        cache.remove(fk);
        console.warn('Circuit breaker aktif untuk ' + provider + '/' + kind +
          ' selama ' + (BREAKER_COOLDOWN_SEC / 60) + ' menit.');
      }
    }

    // Tulis ke sheet dengan lock supaya dua request bersamaan tidak saling menimpa.
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (e) {
      console.warn('Tidak dapat mengunci API_USAGE, pencatatan dilewati.');
      return;
    }
    try {
      const today = Util.today();
      const rows = SheetDB.getRows(SHEETS.API_USAGE);
      let target = null;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (String(r.date) === today && r.provider === provider && r.kind === kind) {
          target = r;
          break;
        }
      }
      if (target) {
        SheetDB.updateRowAt(SHEETS.API_USAGE, target._row, {
          calls: (Number(target.calls) || 0) + 1,
          success: (Number(target.success) || 0) + (success ? 1 : 0),
          failed: (Number(target.failed) || 0) + (success ? 0 : 1),
          last_error: success ? '' : Util.truncate(errorMessage || '', 250),
          last_called_at: Util.now()
        });
      } else {
        SheetDB.appendRow(SHEETS.API_USAGE, {
          date: today,
          provider: provider,
          kind: kind,
          calls: 1,
          success: success ? 1 : 0,
          failed: success ? 0 : 1,
          last_error: success ? '' : Util.truncate(errorMessage || '', 250),
          last_called_at: Util.now()
        });
      }
    } catch (e) {
      console.warn('Gagal mencatat API_USAGE: ' + e.message);
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Ringkasan status semua provider hari ini. Dipakai UI untuk chip status.
   * @return {!Array<!Object>}
   */
  function status() {
    const rows = SheetDB.getRows(SHEETS.API_USAGE);
    const today = Util.today();
    const usage = {};
    rows.forEach(function (r) {
      if (String(r.date) !== today) return;
      usage[r.provider + ':' + r.kind] = r;
    });

    const out = [];
    const imageOrder = Config.list('image_provider_order', DEFAULT_IMAGE_ORDER);
    const textOrder = Config.list('text_provider_order', DEFAULT_TEXT_ORDER);

    function build(provider, kind) {
      const u = usage[provider + ':' + kind] || {};
      const c = check(provider, kind);
      const cap = dailyCap(provider, kind);
      const calls = Number(u.calls) || 0;
      let state = 'ok';
      if (!hasCredentials(provider)) state = 'off';
      else if (!c.available) state = 'blocked';
      else if (cap > 0 && calls >= cap * 0.8) state = 'warn';
      return {
        provider: provider,
        kind: kind,
        state: state,
        available: c.available,
        reason: c.reason,
        calls: calls,
        success: Number(u.success) || 0,
        failed: Number(u.failed) || 0,
        cap: cap,
        lastError: u.last_error || '',
        lastCalledAt: u.last_called_at || ''
      };
    }

    imageOrder.forEach(function (p) { out.push(build(p, 'image')); });
    textOrder.forEach(function (p) { out.push(build(p, 'text')); });
    return out;
  }

  /** Bebaskan semua breaker secara manual (tombol di tab Pengaturan). */
  function resetBreakers() {
    const cache = CacheService.getScriptCache();
    const keys = [];
    Object.keys(PROVIDER_SECRETS).forEach(function (p) {
      ['image', 'text'].forEach(function (k) {
        keys.push(breakerKey_(p, k));
        keys.push(failKey_(p, k));
      });
    });
    cache.removeAll(keys);
    return { ok: true, message: 'Semua circuit breaker dibebaskan.' };
  }

  return {
    hasCredentials: hasCredentials,
    check: check,
    isAvailable: isAvailable,
    record: record,
    status: status,
    callsToday: callsToday,
    dailyCap: dailyCap,
    resetBreakers: resetBreakers,
    PROVIDER_SECRETS: PROVIDER_SECRETS
  };
})();


/**
 * == 5 PROMPT         (dulu PromptBuilder.gs)
 *
 * Merakit prompt dari BRAND + PILLARS + PROMPT_TEMPLATES.
 *
 * Aturan soft-selling ditanam sebagai bagian tetap dari setiap system prompt
 * sehingga tidak bisa hilang walaupun user mengubah template di spreadsheet.
 */
const PromptBuilder = (function () {

  /**
   * Aturan konten yang selalu disisipkan. Inti dari permintaan
   * "jangan terlihat promosi secara blak-blakan".
   * @private
   */
  function houseRules_(brand, pillarId) {
    const forbidden = String(brand.forbidden_words || '')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    const rules = [
      'ATURAN WAJIB (tidak boleh dilanggar dalam keadaan apa pun):',
      '',
      'DILARANG:',
      '- Menyebut harga, angka rupiah, diskon, atau potongan apa pun.',
      '- Memakai kata atau frasa berikut: ' + (forbidden.length ? forbidden.join(', ') : 'promo, diskon, buruan, order sekarang'),
      '- Memakai emoji api, uang, toa, atau rentetan emoji. Maksimal 2 emoji lembut per caption, boleh juga tanpa emoji sama sekali.',
      '- Bahasa hard-sell, clickbait berlebihan, atau huruf kapital semua.',
      '- Mengklaim produk "terbaik", "nomor 1", atau membandingkan dengan merek lain.',
      '- Menyebut nama merek lebih dari SATU KALI dalam satu caption.',
      '- Menulis ajakan membeli secara langsung.',
      '',
      'WAJIB:',
      '- Bahasa Indonesia santai tapi sopan, seperti teman yang sudah pernah menikah dan mau berbagi pengalaman.',
      '- Kalimat pertama adalah hook, maksimal 12 kata, berupa pertanyaan, angka konkret, atau kesalahan umum.',
      '- Isinya harus benar-benar berguna walaupun pembaca tidak pernah membeli apa pun.',
      '- CTA hanya boleh lunak, contoh: "simpan dulu, nanti kepake", "tag pasanganmu",',
      '  "menurut kamu gimana?", "kalau mau lihat contohnya, ada di bio".',
      '- Tutup caption dengan satu pertanyaan supaya memancing komentar.',
      '- Tulis angka dalam bentuk konkret (misalnya "6 bulan", "3 hal"), bukan kira-kira.'
    ];

    if (pillarId === 'softproduct') {
      rules.push(
        '',
        'KHUSUS PILAR SOFT PRODUCT:',
        '- Struktur wajib: bahas masalah nyata -> beri solusi umum yang bisa dipakai siapa saja',
        '  -> baru di KALIMAT TERAKHIR sebut bahwa merek ini dibuat karena alasan tersebut.',
        '- Dilarang memulai dari produk. Dilarang menyebut fitur lebih dari dua.',
        '- Nada harus seperti bercerita, bukan menawarkan.'
      );
    } else {
      rules.push(
        '',
        'KHUSUS PILAR INI:',
        '- Produk TIDAK BOLEH disebut sama sekali. Ini murni konten bermanfaat.'
      );
    }

    return rules.join('\n');
  }

  /** Ganti placeholder {{...}} di template. @private */
  function fill_(template, vars) {
    let out = String(template || '');
    Object.keys(vars).forEach(function (k) {
      out = out.split('{{' + k + '}}').join(vars[k] === undefined || vars[k] === null ? '' : String(vars[k]));
    });
    return out;
  }

  /** @return {?Object} Baris template untuk format tertentu. @private */
  function templateFor_(format) {
    const rows = SheetDB.getRows(SHEETS.PROMPT_TEMPLATES);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].format === format && String(rows[i].active).toLowerCase() !== 'tidak') {
        return rows[i];
      }
    }
    return null;
  }

  /** @return {?Object} Baris pilar. */
  function pillar(pillarId) {
    const rows = SheetDB.getRows(SHEETS.PILLARS);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].pillar_id === pillarId) return rows[i];
    }
    return null;
  }

  /** @return {!Array<!Object>} Semua pilar yang aktif. */
  function activePillars() {
    return SheetDB.getRows(SHEETS.PILLARS).filter(function (r) {
      return String(r.active).toLowerCase() !== 'tidak';
    });
  }

  /**
   * Skema JSON yang diminta ke model, dijelaskan dalam bentuk teks.
   * @private
   */
  function schemaFor_(format, count) {
    if (format === FORMATS.CAROUSEL) {
      return [
        'Balas HANYA dengan objek JSON persis berbentuk ini, tanpa teks pembuka atau penutup:',
        '{',
        '  "topic": "judul topik singkat",',
        '  "hook": "kalimat pembuka caption, maksimal 12 kata",',
        '  "slides": [',
        '    {"order": 1, "type": "cover", "title": "maksimal 7 kata", "body": "maksimal 12 kata", "image_prompt": "prompt bahasa Inggris untuk foto sampul"},',
        '    {"order": 2, "type": "content", "title": "maksimal 6 kata", "body": "maksimal 30 kata", "image_prompt": ""},',
        '    {"order": ' + count + ', "type": "closing", "title": "maksimal 6 kata", "body": "maksimal 25 kata", "image_prompt": ""}',
        '  ],',
        '  "caption": "120-220 kata",',
        '  "cta": "ajakan lunak satu kalimat",',
        '  "hashtags": ["tanpa tanda pagar", "huruf kecil semua"]',
        '}',
        '',
        'Array "slides" harus berisi TEPAT ' + count + ' elemen dengan order 1 sampai ' + count + '.',
        'Elemen pertama bertipe "cover", elemen terakhir bertipe "closing", sisanya "content".',
        'Hanya elemen "cover" yang boleh punya image_prompt terisi; sisanya string kosong.'
      ].join('\n');
    }

    if (format === FORMATS.REELS || format === FORMATS.SHORTS) {
      return [
        'Balas HANYA dengan objek JSON persis berbentuk ini, tanpa teks pembuka atau penutup:',
        '{',
        '  "topic": "judul topik singkat",',
        '  "hook": "kalimat pembuka caption, maksimal 12 kata",',
        '  "onscreen_text": {"headline": "maksimal 7 kata", "subline": "maksimal 14 kata"},',
        '  "caption": "40-80 kata",',
        '  "cta": "ajakan lunak satu kalimat",',
        '  "hashtags": ["tanpa tanda pagar", "huruf kecil semua"],',
        '  "image_prompt": "prompt bahasa Inggris untuk gambar utama",',
        '  "frames": [',
        '    {"order": 1, "onscreen": "maksimal 8 kata", "voiceover": "satu kalimat", "duration_sec": 3, "image_prompt": "prompt bahasa Inggris"}',
        '  ]',
        '}',
        '',
        'Array "frames" harus berisi TEPAT ' + count + ' elemen dengan order 1 sampai ' + count + '.'
      ].join('\n');
    }

    return [
      'Balas HANYA dengan objek JSON persis berbentuk ini, tanpa teks pembuka atau penutup:',
      '{',
      '  "topic": "judul topik singkat",',
      '  "hook": "kalimat pembuka caption, maksimal 12 kata",',
      '  "onscreen_text": {"headline": "maksimal 7 kata", "subline": "maksimal 14 kata"},',
      '  "caption": "' + (format === FORMATS.STORY ? '40-80' : '120-220') + ' kata",',
      '  "cta": "ajakan lunak satu kalimat",',
      '  "hashtags": ["tanpa tanda pagar", "huruf kecil semua"],',
      '  "image_prompt": "prompt bahasa Inggris untuk gambar"',
      '}'
    ].join('\n');
  }

  /**
   * Rakit pasangan system + user prompt lengkap.
   * @param {{format: string, pillarId: string, topic: string, angle: string, count: number}} req
   * @return {{system: string, user: string}}
   */
  function build(req) {
    const brand = Config.brand();
    const p = pillar(req.pillarId) || { name: req.pillarId, description: '', example_angles: '' };
    const tpl = templateFor_(req.format) || {
      system_prompt: 'Kamu penulis konten media sosial untuk merek {{brand}}. Gaya bicara: {{tone}}. Pembaca: {{audience}}.',
      user_prompt: 'Buat satu konten untuk pilar "{{pillar}}". Topik: {{topic}}'
    };

    const vars = {
      brand: brand.brand_name || 'merek ini',
      tone: brand.tone || 'hangat dan santai',
      audience: brand.audience || 'calon pengantin di Indonesia',
      pillar: p.name || req.pillarId,
      pillar_desc: p.description || '',
      angles: req.angle || p.example_angles || '',
      topic: req.topic || '(bebas, pilih yang paling berguna untuk pembaca)',
      slides: req.count,
      frames: req.count,
      language: Config.setting('language', 'id'),
      forbidden: brand.forbidden_words || '',
      visual_style: brand.visual_style || ''
    };

    const system = [
      fill_(tpl.system_prompt, vars),
      '',
      houseRules_(brand, req.pillarId)
    ].join('\n');

    const user = [
      fill_(tpl.user_prompt, vars),
      '',
      schemaFor_(req.format, req.count)
    ].join('\n');

    return { system: system, user: user };
  }

  /**
   * Sufiks gaya visual untuk prompt AI gambar.
   * Frasa "clean negative space" penting: memberi ruang kosong untuk teks.
   */
  function imageStyleSuffix(format, pillarId) {
    const brand = Config.brand();
    const tpl = templateFor_(format);
    const p = pillar(pillarId);

    const parts = [
      brand.visual_style || 'editorial wedding photography, soft natural window light, warm neutral palette',
      p && p.visual_direction ? p.visual_direction : '',
      tpl && tpl.image_style_suffix ? tpl.image_style_suffix : '',
      'clean negative space for typography overlay',
      'no text, no letters, no typography, no watermark, no logo',
      'no clearly visible human faces, photographed from behind or cropped at the shoulders'
    ];

    return parts.filter(Boolean).join(', ');
  }

  /**
   * Gabungkan prompt dari AI dengan sufiks gaya.
   * @return {string}
   */
  function finalImagePrompt(basePrompt, format, pillarId) {
    const base = String(basePrompt || '').trim() ||
      'elegant wedding flatlay on a cream linen background, dried flowers and paper';
    return Util.truncate(base + ', ' + imageStyleSuffix(format, pillarId), AI_IMAGE_MAX_CHARS_PROMPT);
  }

  /**
   * Validator hasil AI. Mengembalikan pesan kesalahan, atau null kalau lolos.
   * Dipakai AiText untuk memutuskan apakah harus pindah provider.
   */
  function validator(format, count) {
    return function (json) {
      if (!json || typeof json !== 'object') return 'bukan objek';
      if (!json.caption || String(json.caption).trim().length < 30) return 'caption kosong atau terlalu pendek';
      if (!json.hashtags || !Array.isArray(json.hashtags) || json.hashtags.length < 3) return 'hashtags kurang dari 3';

      if (format === FORMATS.CAROUSEL) {
        if (!Array.isArray(json.slides)) return 'slides bukan array';
        if (json.slides.length !== count) return 'jumlah slide ' + json.slides.length + ', seharusnya ' + count;
        for (let i = 0; i < json.slides.length; i++) {
          const s = json.slides[i];
          if (!s || !s.title) return 'slide ' + (i + 1) + ' tidak punya judul';
        }
      } else if (format === FORMATS.REELS || format === FORMATS.SHORTS) {
        if (!Array.isArray(json.frames)) return 'frames bukan array';
        if (json.frames.length !== count) return 'jumlah frame ' + json.frames.length + ', seharusnya ' + count;
        for (let i = 0; i < json.frames.length; i++) {
          if (!json.frames[i] || !json.frames[i].onscreen) return 'frame ' + (i + 1) + ' tidak punya teks layar';
        }
      } else {
        if (!json.onscreen_text || !json.onscreen_text.headline) return 'onscreen_text.headline kosong';
      }
      return null;
    };
  }

  /**
   * Periksa apakah caption mengandung kata terlarang.
   * @return {!Array<string>} Daftar kata yang ketahuan.
   */
  function findForbiddenWords(text) {
    const brand = Config.brand();
    const list = String(brand.forbidden_words || '')
      .split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    const lower = String(text || '').toLowerCase();
    return list.filter(function (w) { return lower.indexOf(w) !== -1; });
  }

  /**
   * Bersihkan caption dari kata terlarang sebagai jaring pengaman terakhir,
   * kalau model tetap membandel.
   */
  function sanitizeCaption(text) {
    let out = String(text || '');
    const found = findForbiddenWords(out);
    found.forEach(function (w) {
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, '');
    });
    // Rapikan sisa spasi ganda dan tanda baca menggantung.
    return out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
  }

  return {
    build: build,
    pillar: pillar,
    activePillars: activePillars,
    imageStyleSuffix: imageStyleSuffix,
    finalImagePrompt: finalImagePrompt,
    validator: validator,
    findForbiddenWords: findForbiddenWords,
    sanitizeCaption: sanitizeCaption
  };
})();


/**
 * == 6 AI GAMBAR      (dulu AiImage.gs)
 *
 * Rantai fallback AI gambar.
 *
 * Urutan bawaan: gemini -> cloudflare -> pollinations -> local
 *
 * Together AI TIDAK lagi dipakai secara bawaan: sejak 2026 mereka mewajibkan
 * metode pembayaran terpasang sebelum API key bisa diterbitkan, walaupun
 * endpoint FLUX.1-schnell-Free-nya sendiri tidak menagih biaya. Kodenya tetap
 * disimpan di bawah; tambahkan "together" ke CONFIG.image_provider_order kalau
 * kamu memang sudah punya akun berkartu.
 *
 * Prinsip:
 *   - Tidak ada satu titik kegagalan. Lapis terakhir ("local") tidak memanggil
 *     jaringan sama sekali sehingga mustahil gagal.
 *   - Provider yang kuotanya habis atau key-nya kosong dilewati tanpa dicoba.
 *   - Kegagalan satu provider tidak pernah dilempar ke pemanggil; cukup dicatat
 *     di attempts[] lalu lanjut ke provider berikutnya.
 *
 * Catatan penting: semua gambar diambil di sisi server. Kalau browser memuat URL
 * gambar eksternal langsung ke <img> lalu digambar ke canvas, canvas akan
 * ter-taint dan toDataURL() gagal.
 */
const AiImage = (function () {

  /**
   * Hitung dimensi yang sesuai rasio kanvas pada anggaran piksel tertentu.
   * Dibulatkan ke kelipatan 8 karena sebagian besar model difusi mensyaratkannya.
   *
   * Kenapa penting: meminta gambar persegi lalu memotongnya jadi 9:16 membuang
   * hampir separuh piksel yang sudah susah payah dihasilkan. Meminta langsung
   * dengan rasio yang benar memberi resolusi efektif lebih tinggi pada biaya
   * hitung yang sama.
   *
   * @param {number} ratio lebar/tinggi kanvas tujuan
   * @param {number} pixelBudget total piksel yang ditargetkan
   * @return {{width: number, height: number}}
   */
  function fitToRatio(ratio, pixelBudget) {
    const round8 = function (n) { return Math.max(256, Math.round(n / 8) * 8); };
    const h = Math.sqrt(pixelBudget / ratio);
    return { width: round8(h * ratio), height: round8(h) };
  }

  /**
   * Hasilkan gambar dengan rantai fallback.
   * @param {string} prompt Prompt bahasa Inggris untuk model gambar.
   * @param {{order: (Array<string>|undefined), ratio: (number|undefined),
   *          width: (number|undefined), height: (number|undefined)}=} opts
   * @return {{ok: boolean, base64: ?string, mimeType: string, provider: string, attempts: !Array<!Object>}}
   */
  function generate(prompt, opts) {
    opts = opts || {};
    const cleanPrompt = Util.truncate(String(prompt || '').trim(), AI_IMAGE_MAX_CHARS_PROMPT);
    const order = opts.order || Config.list('image_provider_order', DEFAULT_IMAGE_ORDER);
    const attempts = [];

    if (!cleanPrompt) {
      return { ok: true, base64: null, mimeType: '', provider: 'local', attempts: [
        { provider: 'local', ok: true, note: 'prompt kosong, dipakai latar prosedural' }
      ] };
    }

    for (let i = 0; i < order.length; i++) {
      const provider = order[i];

      // Lapis terakhir: tidak memanggil jaringan, selalu berhasil.
      if (provider === 'local') {
        attempts.push({ provider: 'local', ok: true, note: 'latar prosedural (tanpa AI)' });
        return { ok: true, base64: null, mimeType: '', provider: 'local', attempts: attempts };
      }

      const gate = Quota.check(provider, 'image');
      if (!gate.available) {
        attempts.push({ provider: provider, ok: false, skipped: true, error: gate.reason });
        continue;
      }

      const result = callWithRetry_(provider, cleanPrompt, opts);
      attempts.push({
        provider: provider,
        ok: result.ok,
        error: result.ok ? '' : result.error,
        ms: result.ms
      });
      Quota.record(provider, 'image', result.ok, result.error);

      if (result.ok) {
        return {
          ok: true,
          base64: result.base64,
          mimeType: result.mimeType,
          provider: provider,
          attempts: attempts
        };
      }
    }

    // Semua provider di daftar gagal atau dilewati -> tetap kembalikan sukses
    // dengan latar prosedural supaya produksi konten tidak pernah berhenti.
    attempts.push({ provider: 'local', ok: true, note: 'semua provider gagal, dipakai latar prosedural' });
    return { ok: true, base64: null, mimeType: '', provider: 'local', attempts: attempts };
  }

  /**
   * Panggil satu provider, dengan maksimal satu kali retry untuk status sementara.
   * @private
   */
  function callWithRetry_(provider, prompt, opts) {
    const started = Date.now();
    let last = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = PROVIDERS[provider](prompt, opts);
        return { ok: true, base64: out.base64, mimeType: out.mimeType, ms: Date.now() - started };
      } catch (e) {
        last = e;
        const retryable = e && e.retryable === true;
        if (attempt === 0 && retryable) {
          // Sebagian provider minta jeda lebih panjang; Pollinations misalnya
          // menolak saat ada permintaan lain dari IP yang sama masih berjalan.
          Utilities.sleep(e.retryAfterMs || RETRY_DELAY_MS);
          continue;
        }
        break;
      }
    }
    return {
      ok: false,
      error: last ? String(last.message || last) : 'kesalahan tidak diketahui',
      ms: Date.now() - started
    };
  }

  /**
   * Lempar error yang menandai apakah layak di-retry.
   * @private
   */
  function fail_(message, statusCode) {
    const e = new Error(message);
    e.retryable = HTTP_RETRY_CODES.indexOf(Number(statusCode)) !== -1;
    return e;
  }

  /** Implementasi tiap provider. Masing-masing melempar Error kalau gagal. */
  const PROVIDERS = {

    /**
     * Gemini 2.5 Flash Image (kualitas terbaik untuk konten lifestyle).
     * Gambar dikembalikan sebagai inlineData base64 di dalam parts[].
     */
    gemini: function (prompt) {
      const key = Config.secret('GEMINI_API_KEY');
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
        'gemini-3.1-flash-image:generateContent?key=' + encodeURIComponent(key);

      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const code = res.getResponseCode();
      if (code !== 200) {
        throw fail_('Gemini HTTP ' + code + ': ' + Util.truncate(res.getContentText(), 180), code);
      }

      const body = Util.safeParseJson(res.getContentText());
      const parts = body && body.candidates && body.candidates[0] &&
        body.candidates[0].content && body.candidates[0].content.parts;
      if (!parts || !parts.length) {
        throw fail_('Gemini tidak mengembalikan konten (kemungkinan diblokir filter keamanan).', code);
      }
      for (let i = 0; i < parts.length; i++) {
        const inline = parts[i].inlineData || parts[i].inline_data;
        if (inline && inline.data) {
          return { base64: inline.data, mimeType: inline.mimeType || inline.mime_type || 'image/png' };
        }
      }
      throw fail_('Gemini membalas tanpa data gambar.', code);
    },

    /**
     * Cloudflare Workers AI — FLUX.1 schnell.
     * Benteng utama saat Gemini limit: sekitar 230 gambar per hari, gratis.
     */
    cloudflare: function (prompt) {
      const account = Config.secret('CF_ACCOUNT_ID');
      const token = Config.secret('CF_API_TOKEN');
      const url = 'https://api.cloudflare.com/client/v4/accounts/' + account +
        '/ai/run/@cf/black-forest-labs/flux-1-schnell';

      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
        payload: JSON.stringify({ prompt: prompt, steps: 4 })
      });

      const code = res.getResponseCode();
      if (code !== 200) {
        throw fail_('Cloudflare HTTP ' + code + ': ' + Util.truncate(res.getContentText(), 180), code);
      }

      const body = Util.safeParseJson(res.getContentText());
      if (!body || body.success === false) {
        const msg = body && body.errors && body.errors.length
          ? body.errors.map(function (x) { return x.message; }).join('; ')
          : 'respons tidak dikenali';
        throw fail_('Cloudflare menolak: ' + msg, code);
      }
      if (!body.result || !body.result.image) {
        throw fail_('Cloudflare membalas tanpa data gambar.', code);
      }
      return { base64: body.result.image, mimeType: 'image/jpeg' };
    },

    /**
     * Together AI — endpoint FLUX.1-schnell-Free.
     *
     * TIDAK aktif secara bawaan. Endpoint-nya memang tidak menagih biaya, tapi
     * sejak 2026 Together mewajibkan metode pembayaran terpasang sebelum API
     * key bisa dibuat, sehingga melanggar syarat "tanpa kartu kredit".
     * Aktifkan dengan menambahkan "together" ke CONFIG.image_provider_order
     * kalau kamu memang sudah punya akunnya.
     */
    together: function (prompt, opts) {
      const key = Config.secret('TOGETHER_API_KEY');
      const dims = fitToRatio(opts.ratio || 1, TOGETHER_PIXEL_BUDGET);
      const res = UrlFetchApp.fetch('https://api.together.xyz/v1/images/generations', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + key },
        muteHttpExceptions: true,
        payload: JSON.stringify({
          model: 'black-forest-labs/FLUX.1-schnell-Free',
          prompt: prompt,
          width: dims.width,
          height: dims.height,
          steps: 4,
          n: 1,
          response_format: 'b64_json'
        })
      });

      const code = res.getResponseCode();
      if (code !== 200) {
        throw fail_('Together HTTP ' + code + ': ' + Util.truncate(res.getContentText(), 180), code);
      }
      const body = Util.safeParseJson(res.getContentText());
      const b64 = body && body.data && body.data[0] && body.data[0].b64_json;
      if (!b64) throw fail_('Together membalas tanpa data gambar.', code);
      return { base64: b64, mimeType: 'image/jpeg' };
    },

    /**
     * Pollinations.ai — tanpa akun, tanpa API key. Jaring pengaman utama.
     *
     * Batasnya BUKAN kuota harian melainkan antrean: tier anonim hanya boleh
     * punya 1 permintaan berjalan per alamat IP. Apps Script keluar lewat IP
     * Google yang dipakai bersama banyak orang, jadi HTTP 429 wajar terjadi
     * dan biasanya hilang setelah menunggu sebentar.
     *
     * Responsnya biner, bukan JSON, jadi harus dibaca lewat getBlob().
     */
    pollinations: function (prompt, opts) {
      const dims = (opts.width && opts.height)
        ? { width: opts.width, height: opts.height }
        : fitToRatio(opts.ratio || 1, POLLINATIONS_PIXEL_BUDGET);
      const seed = Math.floor(Math.random() * 1000000);
      const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
        '?width=' + dims.width + '&height=' + dims.height +
        '&nologo=true&model=flux&seed=' + seed;

      const res = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true
      });

      const code = res.getResponseCode();
      if (code === 429) {
        const e = fail_('Pollinations sibuk (antrean IP penuh). Dicoba lagi sebentar.', code);
        e.retryAfterMs = POLLINATIONS_RETRY_MS;
        throw e;
      }
      if (code !== 200) {
        throw fail_('Pollinations HTTP ' + code, code);
      }

      const blob = res.getBlob();
      const type = blob.getContentType() || '';
      if (type.indexOf('image') === -1) {
        throw fail_('Pollinations membalas bukan gambar (' + type + ').', code);
      }
      const bytes = blob.getBytes();
      if (!bytes || bytes.length < 2000) {
        throw fail_('Pollinations membalas gambar rusak (' + (bytes ? bytes.length : 0) + ' byte).', code);
      }
      return { base64: Utilities.base64Encode(bytes), mimeType: type };
    }
  };

  /**
   * Ping satu provider dengan prompt sangat pendek.
   * Perhatian: ini memakai kuota nyata satu panggilan.
   * @return {{provider: string, ok: boolean, message: string, ms: number}}
   */
  function test(provider) {
    if (provider === 'local') {
      return { provider: 'local', ok: true, message: 'Selalu tersedia (tanpa jaringan).', ms: 0 };
    }
    const gate = Quota.check(provider, 'image');
    if (!gate.available) {
      return { provider: provider, ok: false, message: 'Dilewati: ' + gate.reason, ms: 0 };
    }
    const started = Date.now();
    try {
      const out = PROVIDERS[provider]('a single white flower on a cream linen background', {});
      const ms = Date.now() - started;
      Quota.record(provider, 'image', true, '');
      const kb = Math.round(out.base64.length * 0.75 / 1024);
      return { provider: provider, ok: true, message: 'Berhasil, gambar ' + kb + ' KB.', ms: ms };
    } catch (e) {
      const ms = Date.now() - started;
      Quota.record(provider, 'image', false, e.message);
      return { provider: provider, ok: false, message: e.message, ms: ms };
    }
  }

  return {
    generate: generate,
    test: test,
    providerNames: function () { return Object.keys(PROVIDERS).concat(['local']); }
  };
})();


/**
 * == 7 AI TEKS        (dulu AiText.gs)
 *
 * Rantai fallback AI teks.
 *
 * Urutan bawaan: gemini -> groq -> openrouter -> cloudflare -> template
 *
 * Semua provider dipaksa mengembalikan JSON. Parsing dilakukan dengan
 * Util.safeParseJson yang tahan terhadap pagar markdown dan teks pembuka.
 * Kalau hasil parse tidak lolos validasi, provider dianggap gagal dan
 * sistem lanjut ke provider berikutnya.
 */
const AiText = (function () {

  /**
   * Hasilkan JSON terstruktur dengan rantai fallback.
   * @param {{system: string, user: string}} prompts
   * @param {{validate: (function(!Object): (string|null)|undefined),
   *          order: (Array<string>|undefined),
   *          temperature: (number|undefined),
   *          fallbackBuilder: (function(): !Object|undefined)}=} opts
   * @return {{ok: boolean, json: ?Object, provider: string, attempts: !Array<!Object>}}
   */
  function generateJson(prompts, opts) {
    opts = opts || {};
    const order = opts.order || Config.list('text_provider_order', DEFAULT_TEXT_ORDER);
    const temperature = opts.temperature === undefined ? 0.9 : opts.temperature;
    const validate = opts.validate || function () { return null; };
    const attempts = [];

    for (let i = 0; i < order.length; i++) {
      const provider = order[i];

      // Lapis terakhir: penyusun lokal tanpa AI.
      if (provider === 'template') {
        if (!opts.fallbackBuilder) {
          attempts.push({ provider: 'template', ok: false, error: 'tidak ada penyusun lokal untuk permintaan ini' });
          continue;
        }
        const local = opts.fallbackBuilder();
        attempts.push({ provider: 'template', ok: true, note: 'disusun lokal tanpa AI' });
        return { ok: true, json: local, provider: 'template', attempts: attempts };
      }

      const gate = Quota.check(provider, 'text');
      if (!gate.available) {
        attempts.push({ provider: provider, ok: false, skipped: true, error: gate.reason });
        continue;
      }

      const result = callWithRetry_(provider, prompts, temperature);

      if (!result.ok) {
        attempts.push({ provider: provider, ok: false, error: result.error, ms: result.ms });
        Quota.record(provider, 'text', false, result.error);
        continue;
      }

      const parsed = Util.safeParseJson(result.text);
      if (!parsed) {
        const msg = 'balasan bukan JSON yang bisa dibaca';
        attempts.push({ provider: provider, ok: false, error: msg, ms: result.ms });
        Quota.record(provider, 'text', false, msg);
        continue;
      }

      const invalid = validate(parsed);
      if (invalid) {
        const msg = 'JSON tidak lolos validasi: ' + invalid;
        attempts.push({ provider: provider, ok: false, error: msg, ms: result.ms });
        Quota.record(provider, 'text', false, msg);
        continue;
      }

      attempts.push({ provider: provider, ok: true, ms: result.ms });
      Quota.record(provider, 'text', true, '');
      return { ok: true, json: parsed, provider: provider, attempts: attempts };
    }

    // Semua gagal. Kalau ada penyusun lokal, pakai itu supaya tetap ada keluaran.
    if (opts.fallbackBuilder) {
      attempts.push({ provider: 'template', ok: true, note: 'semua provider gagal, disusun lokal' });
      return { ok: true, json: opts.fallbackBuilder(), provider: 'template', attempts: attempts };
    }
    return { ok: false, json: null, provider: '', attempts: attempts };
  }

  /** @private */
  function callWithRetry_(provider, prompts, temperature) {
    const started = Date.now();
    let last = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = PROVIDERS[provider](prompts, temperature);
        return { ok: true, text: text, ms: Date.now() - started };
      } catch (e) {
        last = e;
        if (attempt === 0 && e && e.retryable === true) {
          Utilities.sleep(RETRY_DELAY_MS);
          continue;
        }
        break;
      }
    }
    return {
      ok: false,
      error: last ? String(last.message || last) : 'kesalahan tidak diketahui',
      ms: Date.now() - started
    };
  }

  /** @private */
  function fail_(message, statusCode) {
    const e = new Error(message);
    e.retryable = HTTP_RETRY_CODES.indexOf(Number(statusCode)) !== -1;
    return e;
  }

  /** Bantuan untuk provider bergaya OpenAI (Groq, OpenRouter). */
  function openAiStyle_(url, key, model, prompts, temperature, extraHeaders) {
    const headers = { Authorization: 'Bearer ' + key };
    if (extraHeaders) {
      Object.keys(extraHeaders).forEach(function (k) { headers[k] = extraHeaders[k]; });
    }
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      muteHttpExceptions: true,
      payload: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: prompts.system },
          { role: 'user', content: prompts.user }
        ],
        response_format: { type: 'json_object' },
        temperature: temperature
      })
    });
    const code = res.getResponseCode();
    if (code !== 200) {
      throw fail_('HTTP ' + code + ': ' + Util.truncate(res.getContentText(), 180), code);
    }
    const body = Util.safeParseJson(res.getContentText());
    const content = body && body.choices && body.choices[0] &&
      body.choices[0].message && body.choices[0].message.content;
    if (!content) throw fail_('balasan kosong', code);
    return content;
  }

  const PROVIDERS = {

    /** Gemini Flash dengan responseMimeType application/json. */
    gemini: function (prompts, temperature) {
      const key = Config.secret('GEMINI_API_KEY');
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
        'gemini-3.5-flash:generateContent?key=' + encodeURIComponent(key);

      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({
          systemInstruction: { parts: [{ text: prompts.system }] },
          contents: [{ role: 'user', parts: [{ text: prompts.user }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: temperature,
            maxOutputTokens: 4096
          }
        })
      });

      const code = res.getResponseCode();
      if (code !== 200) {
        throw fail_('Gemini HTTP ' + code + ': ' + Util.truncate(res.getContentText(), 180), code);
      }
      const body = Util.safeParseJson(res.getContentText());
      const cand = body && body.candidates && body.candidates[0];
      if (!cand) throw fail_('Gemini tidak mengembalikan kandidat jawaban.', code);
      if (cand.finishReason === 'SAFETY') throw fail_('Gemini memblokir permintaan (filter keamanan).', code);
      const text = cand.content && cand.content.parts && cand.content.parts
        .map(function (p) { return p.text || ''; }).join('');
      if (!text) throw fail_('Gemini membalas tanpa teks.', code);
      return text;
    },

    /** Groq - sangat cepat, 14.400 request/hari di tier gratis. */
    groq: function (prompts, temperature) {
      return openAiStyle_(
        'https://api.groq.com/openai/v1/chat/completions',
        Config.secret('GROQ_API_KEY'),
        'openai/gpt-oss-20b',
        prompts, temperature
      );
    },

    /** OpenRouter - model :free, kuota harian kecil (50/hari). */
    openrouter: function (prompts, temperature) {
      return openAiStyle_(
        'https://openrouter.ai/api/v1/chat/completions',
        Config.secret('OPENROUTER_API_KEY'),
        'nvidia/nemotron-3.5-lightning:free',
        prompts, temperature,
        { 'X-Title': 'Content Engine Wedding SaaS' }
      );
    },

    /** Cloudflare Workers AI — berbagi kuota neuron dengan generator gambar. */
    cloudflare: function (prompts, temperature) {
      const account = Config.secret('CF_ACCOUNT_ID');
      const token = Config.secret('CF_API_TOKEN');
      const url = 'https://api.cloudflare.com/client/v4/accounts/' + account +
        '/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast';

      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
        payload: JSON.stringify({
          messages: [
            { role: 'system', content: prompts.system + '\n\nJawab HANYA dengan objek JSON valid, tanpa penjelasan apa pun.' },
            { role: 'user', content: prompts.user }
          ],
          temperature: temperature,
          max_tokens: 3000
        })
      });

      const code = res.getResponseCode();
      if (code !== 200) {
        throw fail_('Cloudflare HTTP ' + code + ': ' + Util.truncate(res.getContentText(), 180), code);
      }
      const raw = res.getContentText();
      const body = Util.safeParseJson(raw);
      if (!body) {
        // Sebagian model Workers AI membalas Server-Sent Events walau stream
        // tidak diminta. Petik potongan teksnya supaya tetap terpakai.
        throw fail_('Cloudflare membalas bukan JSON: ' + Util.truncate(raw, 120), code);
      }
      if (body.success === false) {
        const msg = body.errors && body.errors.length
          ? body.errors.map(function (x) { return x.message; }).join('; ')
          : 'respons tidak dikenali';
        throw fail_('Cloudflare menolak: ' + msg, code);
      }
      const text = body.result && body.result.response;
      if (!text) throw fail_('Cloudflare membalas tanpa teks.', code);
      return text;
    }
  };

  /**
   * Ping satu provider teks dengan permintaan sangat kecil.
   * @return {{provider: string, ok: boolean, message: string, ms: number}}
   */
  function test(provider) {
    if (provider === 'template') {
      return { provider: 'template', ok: true, message: 'Selalu tersedia (penyusun lokal).', ms: 0 };
    }
    const gate = Quota.check(provider, 'text');
    if (!gate.available) {
      return { provider: provider, ok: false, message: 'Dilewati: ' + gate.reason, ms: 0 };
    }
    const started = Date.now();
    const prompts = {
      system: 'Kamu asisten yang hanya membalas JSON valid.',
      user: 'Balas persis objek JSON ini: {"status":"ok","angka":7}'
    };
    try {
      const text = PROVIDERS[provider](prompts, 0);
      const ms = Date.now() - started;
      const parsed = Util.safeParseJson(text);
      Quota.record(provider, 'text', true, '');
      if (!parsed) {
        return {
          provider: provider, ok: false, ms: ms,
          message: 'Terhubung, tapi balasannya bukan JSON. Balasan: ' +
            Util.truncate(String(text || '').replace(/\s+/g, ' '), 140)
        };
      }
      return { provider: provider, ok: true, message: 'Berhasil, JSON terbaca.', ms: ms };
    } catch (e) {
      const ms = Date.now() - started;
      Quota.record(provider, 'text', false, e.message);
      return { provider: provider, ok: false, message: e.message, ms: ms };
    }
  }

  return {
    generateJson: generateJson,
    test: test,
    providerNames: function () { return Object.keys(PROVIDERS).concat(['template']); }
  };
})();


/**
 * == 8 DRIVE          (dulu DriveStore.gs)
 *
 * Penyimpanan gambar ke Google Drive.
 *
 * Struktur folder dibuat otomatis:
 *   {root}/01_Story/2026-09/C20260912-7K3D.jpg
 *   {root}/04_Carousel/2026-09/C20260912-7K3D/s1.jpg
 *   {root}/99_Raw_AI/2026-09/C20260912-7K3D_raw.jpg
 */
const DriveStore = (function () {

  /** @return {!Folder} Folder akar dari Script Property DRIVE_ROOT_FOLDER_ID. */
  function root() {
    const id = Config.secret('DRIVE_ROOT_FOLDER_ID');
    if (!id) {
      throw new Error(
        'Script Property "DRIVE_ROOT_FOLDER_ID" belum diisi. ' +
        'Lihat SETUP.md Bagian 1.3 untuk cara mengambil Folder ID.'
      );
    }
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      throw new Error('Folder Drive dengan ID "' + id + '" tidak bisa dibuka. Pastikan ID benar dan folder milik akun ini.');
    }
  }

  /**
   * Cari sub-folder berdasarkan nama, buat kalau belum ada.
   * @return {!Folder}
   */
  function getOrCreateFolder(parent, name) {
    const it = parent.getFoldersByName(name);
    if (it.hasNext()) return it.next();
    return parent.createFolder(name);
  }

  /**
   * Tentukan folder tujuan berdasarkan format konten.
   * Folder bulanan dan sub-folder carousel dibuat otomatis.
   * @param {string} format story|reels|shorts|carousel|feed|raw
   * @param {string} contentId
   * @return {!Folder}
   */
  function resolveFolder(format, contentId) {
    const base = getOrCreateFolder(root(), DRIVE_FOLDERS[format] || DRIVE_FOLDERS.story);
    const monthly = getOrCreateFolder(base, Util.currentMonth());
    // Carousel punya banyak halaman, jadi dikelompokkan dalam satu folder per konten.
    if (format === FORMATS.CAROUSEL) {
      return getOrCreateFolder(monthly, contentId);
    }
    return monthly;
  }

  /**
   * Simpan gambar base64 sebagai file di Drive.
   * @param {string} base64 Tanpa prefix "data:image/...;base64,".
   * @param {string} mimeType
   * @param {string} fileName
   * @param {!Folder} folder
   * @return {{fileId: string, url: string, viewUrl: string, name: string, bytes: number}}
   */
  function saveImage(base64, mimeType, fileName, folder) {
    if (!base64) throw new Error('Data gambar kosong, tidak ada yang bisa disimpan.');
    const clean = String(base64).replace(/^data:[^;]+;base64,/, '');
    const bytes = Utilities.base64Decode(clean);
    if (!bytes || bytes.length === 0) throw new Error('Data gambar rusak (0 byte).');

    const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', fileName);
    const file = folder.createFile(blob);

    // Supaya bisa ditampilkan sebagai pratinjau di UI yang berjalan di luar
    // Apps Script. Tanpa ini, URL thumbnail Drive mengembalikan halaman login
    // (HTML) alih-alih gambar, dan pratinjau tampak rusak.
    //
    // Kegagalannya sengaja dicatat, bukan ditelan diam-diam: dulu hal ini
    // membuat sebagian gambar tidak tampil tanpa jejak apa pun.
    var shared = shareFile_(file);

    const id = file.getId();
    return {
      fileId: id,
      shared: shared,
      url: 'https://drive.google.com/file/d/' + id + '/view',
      viewUrl: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1000',
      name: fileName,
      bytes: bytes.length
    };
  }

  /**
   * Jadikan satu berkas bisa dilihat siapa pun yang punya tautannya.
   * @return {boolean} False kalau ditolak (misalnya kebijakan Workspace).
   * @private
   */
  function shareFile_(file) {
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return true;
    } catch (e) {
      console.warn('Gagal membagikan ' + file.getName() + ': ' + e.message);
      return false;
    }
  }

  /**
   * Perbaiki berkas lama yang belum terbagi publik.
   *
   * Dipakai sekali lewat tab Pengaturan kalau ada pratinjau yang tidak tampil.
   * @return {{checked: number, fixed: number, failed: number}}
   */
  function shareAllImages(limitPerFolder) {
    const limit = Number(limitPerFolder) || 200;
    const base = root();
    const stat = { checked: 0, fixed: 0, failed: 0 };

    // Kumpulkan folder format, lalu sub-folder per bulan di dalamnya.
    const queue = [base];
    const formatFolders = base.getFolders();
    while (formatFolders.hasNext()) queue.push(formatFolders.next());

    queue.slice().forEach(function (folder) {
      const subs = folder.getFolders();
      while (subs.hasNext()) queue.push(subs.next());
    });

    queue.forEach(function (folder) {
      const files = folder.getFiles();
      let n = 0;
      while (files.hasNext() && n < limit) {
        const f = files.next();
        n++;
        stat.checked++;

        let sudah = false;
        try {
          sudah = f.getSharingAccess() === DriveApp.Access.ANYONE_WITH_LINK;
        } catch (e) {
          // Status tidak terbaca; coba bagikan saja.
        }
        if (sudah) continue;

        if (shareFile_(f)) stat.fixed++;
        else stat.failed++;
      }
    });

    return stat;
  }

  /**
   * Simpan hasil mentah dari AI (sebelum diberi teks).
   * Berguna untuk render ulang tanpa memanggil AI lagi.
   * @return {?{fileId: string, url: string}} Null kalau gagal (tidak boleh menghentikan alur utama).
   */
  function saveRaw(base64, mimeType, contentId, index) {
    try {
      const folder = resolveFolder('raw', contentId);
      const ext = (mimeType || 'image/jpeg').indexOf('png') !== -1 ? 'png' : 'jpg';
      const name = contentId + '_raw' + (index ? '_' + index : '') + '.' + ext;
      return saveImage(base64, mimeType, name, folder);
    } catch (e) {
      console.warn('Gagal menyimpan gambar mentah: ' + e.message);
      return null;
    }
  }

  /**
   * Simpan hasil render akhir.
   * @param {string} contentId
   * @param {string} format
   * @param {number} index Nomor urut (1-based). Untuk story/feed selalu 1.
   * @param {string} base64
   * @return {{fileId: string, url: string, viewUrl: string, name: string, bytes: number}}
   */
  function saveRendered(contentId, format, index, base64) {
    const folder = resolveFolder(format, contentId);
    let name;
    if (format === FORMATS.CAROUSEL) {
      name = 's' + index + '.jpg';
    } else if (format === FORMATS.REELS || format === FORMATS.SHORTS) {
      name = contentId + '_f' + index + '.jpg';
    } else {
      name = contentId + '.jpg';
    }
    return saveImage(base64, 'image/jpeg', name, folder);
  }

  /**
   * Baca file Drive kembali menjadi data URL (untuk render ulang tanpa panggil AI).
   * @return {?string}
   */
  function readAsDataUrl(fileId) {
    try {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    } catch (e) {
      return null;
    }
  }

  /**
   * Buang satu berkas ke tempat sampah Drive.
   *
   * Sengaja `setTrashed`, bukan penghapusan permanen: berkas di tempat sampah
   * masih bisa dikembalikan pemiliknya selama 30 hari. Menghapus permanen
   * lewat tombol di aplikasi terlalu berbahaya untuk kesalahan yang tidak bisa
   * dibatalkan.
   *
   * @return {boolean} False kalau berkasnya memang sudah tidak ada.
   * @private
   */
  function trashFile_(fileId) {
    if (!fileId) return false;
    try {
      DriveApp.getFileById(String(fileId)).setTrashed(true);
      return true;
    } catch (e) {
      // Berkas sudah terhapus manual atau ID-nya basi. Bukan kegagalan:
      // tujuannya memang supaya berkas itu tidak ada lagi.
      console.warn('Berkas ' + fileId + ' tidak bisa dibuang: ' + e.message);
      return false;
    }
  }

  /**
   * Hapus seluruh jejak satu konten di Drive.
   *
   * Dua sumber dipakai sekaligus, dan itu disengaja:
   *
   * 1. **ID berkas yang tercatat di spreadsheet** — paling tepat sasaran.
   * 2. **Penelusuran folder menurut pola nama** — menangkap berkas yang
   *    ID-nya tidak pernah tercatat, misalnya gambar mentah atau sisa render
   *    ulang yang gagal di tengah jalan.
   *
   * Tanpa yang kedua, "hapus" akan menyisakan berkas yatim yang memakan kuota
   * Drive tanpa pernah terlihat lagi di aplikasi.
   *
   * @param {string} contentId
   * @param {!Array<string>} fileIds ID yang sudah diketahui dari spreadsheet.
   * @return {{trashed: number, failed: number}}
   */
  function deleteContentFiles(contentId, fileIds) {
    const stat = { trashed: 0, failed: 0 };
    const seen = {};

    (fileIds || []).forEach(function (id) {
      if (!id || seen[id]) return;
      seen[id] = true;
      if (trashFile_(id)) stat.trashed++;
      else stat.failed++;
    });

    // Telusuri folder untuk menangkap sisa yang tidak tercatat.
    try {
      const base = root();
      const formatFolders = base.getFolders();

      while (formatFolders.hasNext()) {
        const fmt = formatFolders.next();
        const months = fmt.getFolders();

        while (months.hasNext()) {
          const month = months.next();

          // Carousel menyimpan tiap konten dalam folder tersendiri bernama
          // contentId; membuang folder itu sekaligus membuang seluruh isinya.
          const own = month.getFoldersByName(contentId);
          if (own.hasNext()) {
            try {
              own.next().setTrashed(true);
              stat.trashed++;
            } catch (e) {
              stat.failed++;
            }
          }

          // Format lain menyimpan berkas langsung dengan contentId di namanya.
          const files = month.getFiles();
          while (files.hasNext()) {
            const f = files.next();
            if (f.getName().indexOf(contentId) !== 0) continue;
            if (seen[f.getId()]) continue;
            seen[f.getId()] = true;
            if (trashFile_(f.getId())) stat.trashed++;
            else stat.failed++;
          }
        }
      }
    } catch (e) {
      // Folder akar tidak terbaca. Berkas yang ID-nya tercatat sudah terbuang,
      // jadi penghapusannya tetap sebagian besar berhasil.
      console.warn('Penelusuran folder dilewati: ' + e.message);
    }

    return stat;
  }

  /**
   * Cek kesehatan konfigurasi Drive. Dipakai tombol "Tes semua provider".
   * @return {{ok: boolean, message: string}}
   */
  function healthCheck() {
    try {
      const r = root();
      const names = [];
      const it = r.getFolders();
      while (it.hasNext()) names.push(it.next().getName());
      return {
        ok: true,
        message: 'Folder "' + r.getName() + '" terbaca. Sub-folder: ' +
          (names.length ? names.sort().join(', ') : 'belum ada (akan dibuat otomatis)')
      };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  return {
    root: root,
    getOrCreateFolder: getOrCreateFolder,
    resolveFolder: resolveFolder,
    saveImage: saveImage,
    saveRaw: saveRaw,
    saveRendered: saveRendered,
    readAsDataUrl: readAsDataUrl,
    shareAllImages: shareAllImages,
    deleteContentFiles: deleteContentFiles,
    healthCheck: healthCheck
  };
})();


/**
 * == 9 PIPELINE       (dulu Pipeline.gs)
 *
 * Orkestrasi alur produksi konten.
 *
 * Setiap fungsi di sini sengaja dibuat kecil supaya satu panggilan
 * google.script.run tidak pernah mendekati batas eksekusi 6 menit.
 */
const Pipeline = (function () {

  /**
   * Pilih pilar secara otomatis: bobot dari sheet PILLARS, dikoreksi dengan
   * distribusi konten terakhir supaya rasio nyata mendekati target.
   * @return {string} pillar_id
   */
  function pickPillarAuto() {
    const pillars = PromptBuilder.activePillars();
    if (!pillars.length) return 'edukasi';

    const window = Config.num('pillar_balance_window', 30);
    const recent = SheetDB.getRows(SHEETS.CONTENT).slice(-window);
    const counts = {};
    recent.forEach(function (r) {
      counts[r.pillar] = (counts[r.pillar] || 0) + 1;
    });

    const totalWeight = pillars.reduce(function (s, p) { return s + (Number(p.weight) || 0); }, 0) || 1;

    // Skor = seberapa tertinggal pilar ini dibanding target proporsinya.
    // Pilar yang sudah kebanyakan dipakai mendapat skor kecil.
    const scored = pillars.map(function (p) {
      const target = (Number(p.weight) || 0) / totalWeight;
      const actual = recent.length ? (counts[p.pillar_id] || 0) / recent.length : 0;
      const deficit = Math.max(0.001, target - actual + 0.02);
      return { id: p.pillar_id, score: deficit * target };
    });

    const sum = scored.reduce(function (s, x) { return s + x.score; }, 0);
    let roll = Math.random() * sum;
    for (let i = 0; i < scored.length; i++) {
      roll -= scored[i].score;
      if (roll <= 0) return scored[i].id;
    }
    return scored[scored.length - 1].id;
  }

  /**
   * Ambil satu ide berstatus "new" dari sheet IDEAS untuk pilar tertentu.
   * @return {?Object}
   */
  function takeIdea(pillarId) {
    const rows = SheetDB.getRows(SHEETS.IDEAS);
    const candidates = rows.filter(function (r) {
      return r.pillar === pillarId && String(r.status || 'new') === 'new';
    });
    if (!candidates.length) return null;
    return Util.pick(candidates);
  }

  /**
   * Pilih hashtag: campuran 2 big + 5 medium + 5 niche, dirotasi berdasarkan
   * yang paling lama tidak dipakai supaya set-nya tidak pernah identik.
   * @return {!Array<string>}
   */
  function pickHashtags(pillarId, total) {
    total = total || Config.num('hashtag_count', 5);
    const rows = SheetDB.getRows(SHEETS.HASHTAG_BANK);
    if (!rows.length) return [];

    const relevant = rows.filter(function (r) {
      return r.pillar === pillarId || r.pillar === 'all';
    });
    const pool = relevant.length >= total ? relevant : rows;

    // Paling lama tidak dipakai lebih dulu.
    function byOldest(a, b) {
      const av = String(a.last_used_at || '');
      const bv = String(b.last_used_at || '');
      if (av === bv) return (Number(a.use_count) || 0) - (Number(b.use_count) || 0);
      if (!av) return -1;
      if (!bv) return 1;
      return av < bv ? -1 : 1;
    }

    const byTier = { big: [], medium: [], niche: [] };
    pool.forEach(function (r) {
      const t = String(r.tier || 'medium');
      if (byTier[t]) byTier[t].push(r);
    });
    Object.keys(byTier).forEach(function (t) { byTier[t].sort(byOldest); });

    // Proporsi 2 : 5 : 5 diskalakan ke total yang diminta.
    const want = {
      big: Math.max(1, Math.round(total * 2 / 12)),
      medium: Math.max(1, Math.round(total * 5 / 12)),
      niche: Math.max(1, Math.round(total * 5 / 12))
    };

    let chosen = [];
    ['big', 'medium', 'niche'].forEach(function (t) {
      chosen = chosen.concat(byTier[t].slice(0, want[t]));
    });

    // Kalau masih kurang, tambal dari sisa mana pun.
    if (chosen.length < total) {
      const used = {};
      chosen.forEach(function (c) { used[c.tag] = true; });
      const rest = pool.filter(function (r) { return !used[r.tag]; }).sort(byOldest);
      chosen = chosen.concat(rest.slice(0, total - chosen.length));
    }
    chosen = chosen.slice(0, total);

    // Tandai sebagai terpakai supaya rotasi berjalan.
    const stamp = Util.now();
    chosen.forEach(function (c) {
      SheetDB.updateRowAt(SHEETS.HASHTAG_BANK, c._row, {
        last_used_at: stamp,
        use_count: (Number(c.use_count) || 0) + 1
      });
    });

    return Util.shuffle(chosen.map(function (c) { return Util.normalizeTag(c.tag); }));
  }

  /**
   * Penyusun konten lokal tanpa AI. Dipakai kalau semua provider teks gagal.
   * Kualitas lebih sederhana, tapi konten tetap terbit.
   * @private
   */
  function localBuilder_(format, pillarId, topic, count) {
    const brand = Config.brand();
    const p = PromptBuilder.pillar(pillarId) || {};
    const idea = takeIdea(pillarId);
    const theTopic = topic || (idea && idea.topic) || (p.name || 'Persiapan pernikahan');
    const theHook = (idea && idea.hook) || 'Hal kecil yang sering terlewat saat persiapan.';

    const base = {
      topic: theTopic,
      hook: theHook,
      caption: [
        theHook,
        '',
        'Catatan singkat soal ' + theTopic.toLowerCase() + '. ' +
        'Tidak ada yang rumit, tapi sering baru kepikiran pas sudah mepet. ' +
        'Kalau kamu lagi di tahap ini, pelan-pelan saja dan kerjakan satu per satu.',
        '',
        'Simpan dulu, nanti kepake. Kamu lagi di tahap mana sekarang?'
      ].join('\n'),
      cta: 'Simpan dulu, nanti kepake.',
      hashtags: pickHashtags(pillarId),
      image_prompt: (p.visual_direction || 'elegant wedding flatlay on cream linen, dried flowers, paper texture')
    };

    if (format === FORMATS.CAROUSEL) {
      const slides = [];
      slides.push({ order: 1, type: 'cover', title: theTopic, body: theHook, image_prompt: base.image_prompt });
      for (let i = 2; i < count; i++) {
        slides.push({
          order: i, type: 'content',
          title: 'Poin ' + (i - 1),
          body: 'Isi halaman ini belum tersusun otomatis karena semua layanan AI teks sedang tidak tersedia. Silakan tulis manual lalu render ulang.',
          image_prompt: ''
        });
      }
      slides.push({
        order: count, type: 'closing',
        title: 'Sampai sini dulu', body: base.cta, image_prompt: ''
      });
      base.slides = slides;
    } else if (format === FORMATS.REELS || format === FORMATS.SHORTS) {
      const frames = [];
      for (let i = 1; i <= count; i++) {
        frames.push({
          order: i,
          onscreen: i === 1 ? theHook : 'Poin ' + (i - 1),
          voiceover: i === 1 ? theHook : 'Silakan isi manual.',
          duration_sec: 3,
          image_prompt: base.image_prompt
        });
      }
      base.frames = frames;
      base.onscreen_text = { headline: theTopic, subline: theHook };
    } else {
      base.onscreen_text = { headline: theTopic, subline: theHook };
    }

    return base;
  }

  /**
   * Langkah 1 — hasilkan naskah lengkap (ide + caption + prompt gambar).
   * @param {string} format
   * @param {string} pillarId "auto" untuk memilih otomatis.
   * @param {string} topic Boleh kosong.
   * @param {{count: (number|undefined)}=} opts
   * @return {!Object}
   */
  function generateContentText(format, pillarId, topic, opts) {
    opts = opts || {};
    const pillar = (!pillarId || pillarId === 'auto') ? pickPillarAuto() : pillarId;

    let count;
    if (format === FORMATS.CAROUSEL) {
      count = Number(opts.count) || Config.num('carousel_slides_default', 7);
      count = Math.min(10, Math.max(3, count));
    } else if (format === FORMATS.REELS || format === FORMATS.SHORTS) {
      count = Number(opts.count) || Config.num('reels_frames_default', 4);
      count = Math.min(6, Math.max(2, count));
    } else {
      count = 1;
    }

    const idea = topic ? null : takeIdea(pillar);
    const effectiveTopic = topic || (idea ? idea.topic : '');
    const angle = idea ? idea.angle : '';

    const prompts = PromptBuilder.build({
      format: format,
      pillarId: pillar,
      topic: effectiveTopic,
      angle: angle,
      count: count
    });

    const result = AiText.generateJson(prompts, {
      validate: PromptBuilder.validator(format, count),
      temperature: 0.9,
      fallbackBuilder: function () { return localBuilder_(format, pillar, effectiveTopic, count); }
    });

    if (!result.ok || !result.json) {
      throw new Error('Semua provider teks gagal dan penyusun lokal tidak tersedia. Cek tab Pengaturan > Tes semua provider.');
    }

    const spec = result.json;
    const contentId = Util.contentId();

    // Jaring pengaman: bersihkan kata terlarang kalau model membandel.
    const flagged = PromptBuilder.findForbiddenWords(spec.caption);
    if (flagged.length) {
      spec.caption = PromptBuilder.sanitizeCaption(spec.caption);
    }

    // Hashtag dari bank selalu dipakai supaya rotasinya terkendali,
    // digabung dengan usulan model sebagai pelengkap.
    const bankTags = pickHashtags(pillar);
    const modelTags = (spec.hashtags || []).map(Util.normalizeTag).filter(Boolean);
    const merged = [];
    const seen = {};
    bankTags.concat(modelTags).forEach(function (t) {
      if (!t || seen[t]) return;
      seen[t] = true;
      merged.push(t);
    });
    spec.hashtags = merged.slice(0, Config.num('hashtag_count', 5));

    // Normalisasi prompt gambar supaya konsisten dengan gaya brand.
    spec.image_prompt = PromptBuilder.finalImagePrompt(
      spec.image_prompt || (spec.slides && spec.slides[0] && spec.slides[0].image_prompt),
      format, pillar
    );
    if (Array.isArray(spec.frames)) {
      spec.frames.forEach(function (f) {
        f.image_prompt = PromptBuilder.finalImagePrompt(f.image_prompt || spec.image_prompt, format, pillar);
      });
    }

    // Tandai ide sebagai terpakai.
    if (idea) {
      SheetDB.updateRowAt(SHEETS.IDEAS, idea._row, {
        status: 'used',
        used_in_content_id: contentId
      });
    }

    return {
      content_id: contentId,
      format: format,
      pillar: pillar,
      count: count,
      spec: spec,
      text_provider: result.provider,
      attempts: result.attempts,
      sanitized: flagged
    };
  }

  /**
   * Langkah 2 — ambil gambar dari AI dengan rantai fallback.
   * Hasil mentah ikut disimpan ke 99_Raw_AI supaya bisa dirender ulang nanti.
   * @return {!Object}
   */
  function fetchAiImage(prompt, contentId, index, format) {
    const size = CANVAS_SIZE[format] || CANVAS_SIZE.story;
    // Minta gambar dengan rasio kanvas tujuan, bukan persegi: memotong persegi
    // jadi 9:16 membuang hampir separuh piksel yang sudah dihasilkan.
    const result = AiImage.generate(prompt, { ratio: size.w / size.h });

    let raw = null;
    if (result.base64 && contentId) {
      raw = DriveStore.saveRaw(result.base64, result.mimeType, contentId, index || 1);
    }

    return {
      provider: result.provider,
      attempts: result.attempts,
      // Dikirim sebagai data URL supaya canvas di browser tidak ter-taint.
      dataUrl: result.base64 ? ('data:' + (result.mimeType || 'image/jpeg') + ';base64,' + result.base64) : null,
      rawFileId: raw ? raw.fileId : ''
    };
  }

  /**
   * Langkah 3 — simpan hasil render dari browser ke Drive.
   * @return {{fileId: string, url: string, viewUrl: string}}
   */
  function uploadRendered(contentId, format, index, base64) {
    return DriveStore.saveRendered(contentId, format, Number(index) || 1, base64);
  }

  /**
   * Langkah 4 — tulis konten ke sheet CONTENT (+ SLIDES untuk carousel).
   * @return {{ok: boolean, content_id: string}}
   */
  function saveContent(payload) {
    const spec = payload.spec || {};
    const contentId = payload.content_id;
    const files = payload.files || [];
    const cover = files.length ? files[0] : {};

    SheetDB.appendRow(SHEETS.CONTENT, {
      content_id: contentId,
      created_at: Util.now(),
      pillar: payload.pillar,
      format: payload.format,
      topic: spec.topic || '',
      hook: spec.hook || '',
      caption: spec.caption || '',
      hashtags: (spec.hashtags || []).map(function (t) { return '#' + t; }).join(' '),
      cta: spec.cta || '',
      image_prompt: spec.image_prompt || '',
      image_provider: payload.image_provider || '',
      text_provider: payload.text_provider || '',
      drive_file_id: cover.fileId || '',
      drive_url: cover.url || '',
      slide_count: files.length,
      status: 'ready',
      scheduled_at: '',
      notes: payload.notes || ''
    });

    if (payload.format === FORMATS.CAROUSEL && Array.isArray(spec.slides)) {
      const rows = spec.slides.map(function (s, i) {
        const f = files[i] || {};
        return {
          slide_id: contentId + '-S' + (i + 1),
          content_id: contentId,
          order: s.order || (i + 1),
          slide_type: s.type || 'content',
          title: s.title || '',
          body: s.body || '',
          image_prompt: s.image_prompt || '',
          drive_file_id: f.fileId || '',
          drive_url: f.url || ''
        };
      });
      SheetDB.appendRows(SHEETS.SLIDES, rows);
    }

    if ((payload.format === FORMATS.REELS || payload.format === FORMATS.SHORTS) && Array.isArray(spec.frames)) {
      const rows = spec.frames.map(function (fr, i) {
        const f = files[i] || {};
        return {
          slide_id: contentId + '-F' + (i + 1),
          content_id: contentId,
          order: fr.order || (i + 1),
          slide_type: 'frame',
          title: fr.onscreen || '',
          body: fr.voiceover || '',
          image_prompt: fr.image_prompt || '',
          drive_file_id: f.fileId || '',
          drive_url: f.url || ''
        };
      });
      SheetDB.appendRows(SHEETS.SLIDES, rows);
    }

    return { ok: true, content_id: contentId };
  }

  /**
   * Hasilkan ide baru dan simpan ke sheet IDEAS.
   * @return {!Object}
   */
  function generateIdeas(pillarId, count) {
    const pillar = (!pillarId || pillarId === 'auto') ? pickPillarAuto() : pillarId;
    count = Math.min(10, Math.max(1, Number(count) || 5));
    const brand = Config.brand();
    const p = PromptBuilder.pillar(pillar) || {};

    const existing = SheetDB.getRows(SHEETS.IDEAS)
      .filter(function (r) { return r.pillar === pillar; })
      .map(function (r) { return r.topic; })
      .slice(-25);

    const prompts = {
      system: 'Kamu perencana konten media sosial untuk merek ' + (brand.brand_name || 'ini') +
        '. Pembaca: ' + (brand.audience || 'calon pengantin di Indonesia') + '.\n\n' +
        'Tugasmu hanya mengusulkan ide, bukan menulis kontennya.',
      user: [
        'Usulkan ' + count + ' ide konten untuk pilar "' + (p.name || pillar) + '".',
        'Deskripsi pilar: ' + (p.description || ''),
        'Contoh sudut pandang: ' + (p.example_angles || ''),
        '',
        existing.length ? 'HINDARI topik yang mirip dengan yang sudah ada ini:\n- ' + existing.join('\n- ') : '',
        '',
        'Setiap ide harus spesifik dan bisa langsung dikerjakan, bukan tema umum.',
        'Dilarang mengusulkan ide yang isinya menjual produk secara langsung.',
        '',
        'Balas HANYA dengan JSON berbentuk:',
        '{"ideas":[{"topic":"judul spesifik","angle":"sudut pandang, satu kalimat","hook":"kalimat pembuka, maksimal 12 kata"}]}'
      ].join('\n')
    };

    const result = AiText.generateJson(prompts, {
      temperature: 1.0,
      validate: function (json) {
        if (!json.ideas || !Array.isArray(json.ideas) || !json.ideas.length) return 'ideas kosong';
        if (!json.ideas[0].topic) return 'ide pertama tanpa topic';
        return null;
      }
    });

    if (!result.ok || !result.json) {
      return { ok: false, added: 0, provider: '', attempts: result.attempts,
        message: 'Semua provider teks sedang tidak tersedia. Ide bisa diisi manual di tab IDEAS.' };
    }

    const rows = result.json.ideas.slice(0, count).map(function (it) {
      return {
        idea_id: Util.shortId('I'),
        created_at: Util.now(),
        pillar: pillar,
        topic: it.topic || '',
        angle: it.angle || '',
        hook: it.hook || '',
        status: 'new',
        used_in_content_id: ''
      };
    });
    SheetDB.appendRows(SHEETS.IDEAS, rows);

    return {
      ok: true,
      added: rows.length,
      pillar: pillar,
      ideas: rows,
      provider: result.provider,
      attempts: result.attempts
    };
  }

  return {
    pickPillarAuto: pickPillarAuto,
    takeIdea: takeIdea,
    pickHashtags: pickHashtags,
    generateContentText: generateContentText,
    fetchAiImage: fetchAiImage,
    uploadRendered: uploadRendered,
    saveContent: saveContent,
    generateIdeas: generateIdeas
  };
})();


/**
 * == 10 FUNGSI API     (dulu Main.gs)
 *
 * Seluruh fungsi publik yang dipanggil lewat Api.gs.
 *
 * Semua fungsi publik dibungkus wrap_() sehingga klien selalu menerima
 * objek {ok: true, data: ...} atau {ok: false, error: "pesan ramah"} —
 * tidak pernah exception mentah.
 *
 * Tidak ada doGet di sini: backend ini murni API. Antarmukanya adalah aplikasi
 * React terpisah yang memanggil doPost di Api.gs. Deployment ini sengaja tidak
 * menyajikan HTML apa pun.
 */

/**
 * Bungkus pemanggilan supaya klien tidak pernah menerima exception mentah.
 * @private
 */
function wrap_(label, fn) {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    console.error(label + ' gagal: ' + msg + '\n' + (e && e.stack ? e.stack : ''));
    return { ok: false, error: msg };
  }
}

/* ----------------------------------------------------------------------------
 * Pengaturan & inisialisasi
 * -------------------------------------------------------------------------- */

/** Buat semua tab + data awal. Aman dijalankan berulang kali. */
function apiInitDatabase() {
  return wrap_('apiInitDatabase', function () {
    return initDatabase();
  });
}

/** Data awal yang dibutuhkan UI saat dibuka. */
function apiGetBootstrap() {
  return wrap_('apiGetBootstrap', function () {
    Config.invalidate();

    const tabsMissing = Object.keys(SCHEMA).filter(function (n) { return !SheetDB.sheet(n); });
    if (tabsMissing.length) {
      return {
        initialized: false,
        missingTabs: tabsMissing,
        brand: {},
        pillars: [],
        config: {},
        providers: []
      };
    }

    const content = SheetDB.getRows(SHEETS.CONTENT);
    const byStatus = {};
    const byPillar = {};
    content.forEach(function (r) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byPillar[r.pillar] = (byPillar[r.pillar] || 0) + 1;
    });

    return {
      initialized: true,
      missingTabs: [],
      brand: Config.brand(),
      config: Config.settings(),
      pillars: PromptBuilder.activePillars().map(function (p) {
        return { id: p.pillar_id, name: p.name, weight: Number(p.weight) || 0, description: p.description };
      }),
      providers: Quota.status(),
      stats: {
        total: content.length,
        byStatus: byStatus,
        byPillar: byPillar,
        ideasNew: SheetDB.getRows(SHEETS.IDEAS).filter(function (r) { return String(r.status || 'new') === 'new'; }).length
      }
    };
  });
}

/** Simpan perubahan BRAND dan/atau CONFIG dari UI. */
function apiSaveSettings(payload) {
  return wrap_('apiSaveSettings', function () {
    if (payload && payload.brand) SheetDB.kvSetMany(SHEETS.BRAND, payload.brand);
    if (payload && payload.config) SheetDB.kvSetMany(SHEETS.CONFIG, payload.config);
    Config.invalidate();
    return { saved: true };
  });
}

/** Status kuota semua provider hari ini. */
function apiGetQuotaStatus() {
  return wrap_('apiGetQuotaStatus', function () {
    return { providers: Quota.status(), date: Util.today() };
  });
}

/**
 * Bagikan ulang semua gambar lama supaya bisa tampil sebagai pratinjau.
 *
 * Diperlukan untuk berkas yang tersimpan sebelum UI berjalan di luar Apps
 * Script: URL thumbnail Drive butuh akses "siapa pun yang punya tautan",
 * kalau tidak yang kembali adalah halaman login, bukan gambar.
 */
function apiShareAllImages() {
  return wrap_('apiShareAllImages', function () {
    const s = DriveStore.shareAllImages();
    return {
      ok: true,
      message: s.checked + ' berkas diperiksa, ' + s.fixed + ' diperbaiki' +
        (s.failed ? ', ' + s.failed + ' gagal' : '') + '.'
    };
  });
}

/** Bebaskan semua circuit breaker secara manual. */
function apiResetBreakers() {
  return wrap_('apiResetBreakers', function () {
    return Quota.resetBreakers();
  });
}

/**
 * Ping provider satu per satu.
 * @param {string} kind "text", "image", atau "all".
 */
function apiTestProviders(kind) {
  return wrap_('apiTestProviders', function () {
    const out = { drive: DriveStore.healthCheck(), text: [], image: [] };

    if (kind === 'text' || kind === 'all' || !kind) {
      Config.list('text_provider_order', DEFAULT_TEXT_ORDER)
        .forEach(function (p) { out.text.push(AiText.test(p)); });
    }
    if (kind === 'image' || kind === 'all') {
      Config.list('image_provider_order', DEFAULT_IMAGE_ORDER)
        .forEach(function (p) { out.image.push(AiImage.test(p)); });
    }
    return out;
  });
}

/* ----------------------------------------------------------------------------
 * Produksi konten — dipecah per langkah agar tidak kena batas 6 menit
 * -------------------------------------------------------------------------- */

/** Langkah 1: naskah + caption + prompt gambar. */
function apiGenerateContentText(format, pillar, topic, opts) {
  return wrap_('apiGenerateContentText', function () {
    return Pipeline.generateContentText(format, pillar, topic, opts || {});
  });
}

/** Langkah 2: ambil satu gambar dari AI (dengan fallback). */
function apiFetchAiImage(prompt, contentId, index, format) {
  return wrap_('apiFetchAiImage', function () {
    return Pipeline.fetchAiImage(prompt, contentId, index, format);
  });
}

/** Langkah 3: simpan satu hasil render ke Drive. */
function apiUploadRendered(contentId, format, index, base64) {
  return wrap_('apiUploadRendered', function () {
    return Pipeline.uploadRendered(contentId, format, index, base64);
  });
}

/** Langkah 4: catat konten ke spreadsheet. */
function apiSaveContent(payload) {
  return wrap_('apiSaveContent', function () {
    return Pipeline.saveContent(payload);
  });
}

/** Hasilkan ide baru ke sheet IDEAS. */
function apiGenerateIdeas(pillar, count) {
  return wrap_('apiGenerateIdeas', function () {
    return Pipeline.generateIdeas(pillar, count);
  });
}

/** Daftar ide yang belum dipakai. */
function apiListIdeas(pillar) {
  return wrap_('apiListIdeas', function () {
    return SheetDB.getRows(SHEETS.IDEAS)
      .filter(function (r) {
        if (String(r.status || 'new') !== 'new') return false;
        return !pillar || pillar === 'auto' || r.pillar === pillar;
      })
      .map(function (r) {
        return { id: r.idea_id, pillar: r.pillar, topic: r.topic, angle: r.angle, hook: r.hook };
      })
      .reverse()
      .slice(0, 50);
  });
}

/* ----------------------------------------------------------------------------
 * Library & kalender
 * -------------------------------------------------------------------------- */

/** Daftar konten untuk tab Library. */
function apiListContent(filter) {
  return wrap_('apiListContent', function () {
    filter = filter || {};
    let rows = SheetDB.getRows(SHEETS.CONTENT);

    if (filter.status) rows = rows.filter(function (r) { return r.status === filter.status; });
    if (filter.format) rows = rows.filter(function (r) { return r.format === filter.format; });
    if (filter.pillar) rows = rows.filter(function (r) { return r.pillar === filter.pillar; });

    rows = rows.reverse().slice(0, Number(filter.limit) || 100);

    return rows.map(function (r) {
      return {
        content_id: r.content_id,
        created_at: String(r.created_at),
        pillar: r.pillar,
        format: r.format,
        topic: r.topic,
        hook: r.hook,
        caption: r.caption,
        hashtags: r.hashtags,
        image_provider: r.image_provider,
        text_provider: r.text_provider,
        drive_file_id: r.drive_file_id,
        drive_url: r.drive_url,
        thumb: r.drive_file_id ? ('https://drive.google.com/thumbnail?id=' + r.drive_file_id + '&sz=w400') : '',
        slide_count: Number(r.slide_count) || 0,
        status: r.status,
        scheduled_at: String(r.scheduled_at || '')
      };
    });
  });
}

/** Detail satu konten beserta semua halaman/frame-nya. */
function apiGetContent(contentId) {
  return wrap_('apiGetContent', function () {
    const rows = SheetDB.getRows(SHEETS.CONTENT).filter(function (r) { return r.content_id === contentId; });
    if (!rows.length) throw new Error('Konten "' + contentId + '" tidak ditemukan.');
    const c = rows[0];
    const slides = SheetDB.getRows(SHEETS.SLIDES)
      .filter(function (s) { return s.content_id === contentId; })
      .sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); })
      .map(function (s) {
        return {
          order: Number(s.order) || 0,
          type: s.slide_type,
          title: s.title,
          body: s.body,
          drive_file_id: s.drive_file_id,
          thumb: s.drive_file_id ? ('https://drive.google.com/thumbnail?id=' + s.drive_file_id + '&sz=w400') : '',
          url: s.drive_url
        };
      });
    return {
      content: {
        content_id: c.content_id,
        created_at: String(c.created_at),
        pillar: c.pillar,
        format: c.format,
        topic: c.topic,
        hook: c.hook,
        caption: c.caption,
        hashtags: c.hashtags,
        cta: c.cta,
        image_provider: c.image_provider,
        text_provider: c.text_provider,
        drive_file_id: c.drive_file_id,
        drive_url: c.drive_url,
        thumb: c.drive_file_id ? ('https://drive.google.com/thumbnail?id=' + c.drive_file_id + '&sz=w800') : '',
        status: c.status,
        scheduled_at: String(c.scheduled_at || ''),
        notes: String(c.notes || '')
      },
      slides: slides
    };
  });
}

/**
 * Hapus satu konten beserta seluruh berkasnya di Drive.
 *
 * Tidak bisa dibatalkan dari aplikasi, jadi urutannya penting: **berkas Drive
 * dibuang lebih dulu, catatan spreadsheet belakangan.** Kalau dibalik dan
 * penghapusan berkas gagal di tengah, ID berkasnya sudah lenyap dari
 * spreadsheet dan berkas itu jadi yatim — memakan kuota Drive selamanya tanpa
 * pernah bisa ditemukan lagi lewat aplikasi.
 *
 * Berkas dibuang ke tempat sampah Drive, bukan dihapus permanen, sehingga
 * pemiliknya masih bisa memulihkannya selama 30 hari.
 *
 * @param {string} contentId
 * @return {{deleted: boolean, files: number, rows: number}}
 */
function apiDeleteContent(contentId) {
  return wrap_('apiDeleteContent', function () {
    const id = String(contentId || '').trim();
    if (!id) throw new Error('ID konten kosong.');

    const rows = SheetDB.getRows(SHEETS.CONTENT).filter(function (r) {
      return r.content_id === id;
    });
    if (!rows.length) throw new Error('Konten "' + id + '" tidak ditemukan.');

    // Kumpulkan setiap ID berkas yang tercatat, dari konten maupun tiap
    // halamannya.
    const fileIds = [];
    if (rows[0].drive_file_id) fileIds.push(String(rows[0].drive_file_id));

    SheetDB.getRows(SHEETS.SLIDES).forEach(function (s) {
      if (s.content_id === id && s.drive_file_id) fileIds.push(String(s.drive_file_id));
    });

    // 1. Berkas lebih dulu — lihat alasannya di komentar atas.
    const drive = DriveStore.deleteContentFiles(id, fileIds);

    // 2. Baru catatan di spreadsheet, termasuk jadwal terbitnya.
    let deletedRows = 0;
    deletedRows += SheetDB.deleteWhere(SHEETS.SLIDES, 'content_id', id);
    deletedRows += SheetDB.deleteWhere(SHEETS.PUBLISH_LOG, 'content_id', id);
    deletedRows += SheetDB.deleteWhere(SHEETS.CONTENT, 'content_id', id);

    // Ide yang tercatat memakai konten ini dikembalikan jadi tersedia, bukan
    // ikut terhapus: idenya sendiri masih bagus, hanya kontennya yang dibuang.
    SheetDB.getRows(SHEETS.IDEAS).forEach(function (i) {
      if (String(i.used_in_content_id) === id) {
        SheetDB.updateWhere(SHEETS.IDEAS, 'idea_id', i.idea_id, {
          status: 'new',
          used_in_content_id: ''
        });
      }
    });

    return {
      deleted: true,
      files: drive.trashed,
      failedFiles: drive.failed,
      rows: deletedRows
    };
  });
}

/** Ubah status konten (ready / approved / posted). */
function apiUpdateContentStatus(contentId, status) {
  return wrap_('apiUpdateContentStatus', function () {
    const allowed = ['draft', 'ready', 'approved', 'posted'];
    if (allowed.indexOf(status) === -1) throw new Error('Status "' + status + '" tidak dikenal.');
    const ok = SheetDB.updateWhere(SHEETS.CONTENT, 'content_id', contentId, { status: status });
    if (!ok) throw new Error('Konten "' + contentId + '" tidak ditemukan.');
    if (status === 'posted') {
      SheetDB.updateWhere(SHEETS.PUBLISH_LOG, 'content_id', contentId, {
        posted_at: Util.now(), status: 'posted'
      });
    }
    return { updated: true };
  });
}

/** Perbarui caption hasil editan manual di UI. */
function apiUpdateCaption(contentId, caption, hashtags) {
  return wrap_('apiUpdateCaption', function () {
    const patch = { caption: PromptBuilder.sanitizeCaption(caption) };
    if (hashtags !== undefined && hashtags !== null) patch.hashtags = hashtags;
    const ok = SheetDB.updateWhere(SHEETS.CONTENT, 'content_id', contentId, patch);
    if (!ok) throw new Error('Konten "' + contentId + '" tidak ditemukan.');
    return { updated: true };
  });
}

/**
 * Perbarui judul dan isi satu halaman hasil suntingan manual di UI.
 *
 * Dicari lewat pasangan content_id + order karena `slide_id` tidak dikirim ke
 * klien; nomor barisnya diambil dari `_row` yang sudah dibawa getRows.
 */
function apiUpdateSlideText(contentId, order, title, body) {
  return wrap_('apiUpdateSlideText', function () {
    const rows = SheetDB.getRows(SHEETS.SLIDES);
    let target = null;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].content_id === contentId && Number(rows[i].order) === Number(order)) {
        target = rows[i];
        break;
      }
    }
    if (!target) {
      throw new Error('Halaman ' + order + ' pada konten "' + contentId + '" tidak ditemukan.');
    }

    SheetDB.updateRowAt(SHEETS.SLIDES, target._row, {
      title: String(title === undefined || title === null ? '' : title),
      body: String(body === undefined || body === null ? '' : body)
    });

    // Halaman sampul juga menjadi hook konten, supaya Library dan sampul tidak
    // menampilkan judul yang berbeda setelah disunting.
    if (Number(order) === 1) {
      SheetDB.updateWhere(SHEETS.CONTENT, 'content_id', contentId, { hook: String(title || '') });
    }
    return { updated: true };
  });
}

/**
 * Simpan penyetelan visual per konten.
 *
 * Disimpan sebagai JSON di kolom `notes` yang sudah ada, bukan kolom baru:
 * menambah kolom memaksa setiap pengguna menjalankan ulang initDatabase() pada
 * spreadsheet yang sudah berisi data. Kolom ini memang untuk catatan bebas.
 */
function apiSaveDesign(contentId, design) {
  return wrap_('apiSaveDesign', function () {
    const json = design ? JSON.stringify(design) : '';
    const ok = SheetDB.updateWhere(SHEETS.CONTENT, 'content_id', contentId, { notes: json });
    if (!ok) throw new Error('Konten "' + contentId + '" tidak ditemukan.');
    return { saved: true };
  });
}

/**
 * Simpan logo merek ke Drive dan catat id-nya di sheet BRAND.
 *
 * Logo disimpan di folder akar, bukan di folder bulanan seperti gambar konten:
 * ia bukan hasil produksi yang bertambah tiap bulan, melainkan satu berkas
 * yang diganti sesekali. Berkas lama dibuang supaya folder tidak menumpuk
 * logo yang sudah tidak terpakai.
 *
 * @param {string} base64 Tanpa prefix "data:image/...;base64,".
 * @param {string} mimeType
 * @return {{fileId: string, url: string}}
 */
function apiUploadLogo(base64, mimeType) {
  return wrap_('apiUploadLogo', function () {
    if (!base64) throw new Error('Tidak ada berkas yang dikirim.');

    const ext = String(mimeType || '').indexOf('png') !== -1 ? 'png' : 'jpg';
    const saved = DriveStore.saveImage(
      base64,
      mimeType || 'image/png',
      'logo.' + ext,
      DriveStore.root()
    );

    const previous = String(Config.brand()['logo_drive_id'] || '');
    SheetDB.kvSet(SHEETS.BRAND, 'logo_drive_id', saved.fileId);
    Config.invalidate();

    // Dibuang setelah id baru tercatat: kalau langkah di atas gagal, logo lama
    // masih utuh dan merek tidak kehilangan apa pun.
    if (previous && previous !== saved.fileId) {
      try {
        DriveApp.getFileById(previous).setTrashed(true);
      } catch (e) {
        console.warn('Logo lama tidak bisa dibuang: ' + e.message);
      }
    }

    return { fileId: saved.fileId, url: saved.viewUrl };
  });
}

/**
 * Baca logo sebagai data URL supaya bisa digambar ke canvas.
 *
 * URL Drive langsung tidak bisa dipakai: menggambar gambar lintas-domain ke
 * canvas membuatnya ter-taint, dan toDataURL() sesudahnya gagal.
 *
 * @return {{dataUrl: ?string}}
 */
function apiGetLogo() {
  return wrap_('apiGetLogo', function () {
    const id = String(Config.brand()['logo_drive_id'] || '');
    if (!id) return { dataUrl: null };
    return { dataUrl: DriveStore.readAsDataUrl(id) };
  });
}

/** Lepas logo dari merek. Berkasnya dibuang ke tempat sampah Drive. */
function apiRemoveLogo() {
  return wrap_('apiRemoveLogo', function () {
    const id = String(Config.brand()['logo_drive_id'] || '');
    SheetDB.kvSet(SHEETS.BRAND, 'logo_drive_id', '');
    Config.invalidate();

    if (id) {
      try {
        DriveApp.getFileById(id).setTrashed(true);
      } catch (e) {
        console.warn('Berkas logo tidak bisa dibuang: ' + e.message);
      }
    }
    return { removed: true };
  });
}

/** Jadwalkan publikasi. */
function apiSchedulePublish(contentId, platform, datetime) {
  return wrap_('apiSchedulePublish', function () {
    SheetDB.appendRow(SHEETS.PUBLISH_LOG, {
      log_id: Util.shortId('P'),
      content_id: contentId,
      platform: platform,
      scheduled_at: datetime,
      posted_at: '',
      status: 'scheduled',
      link: '',
      notes: ''
    });
    SheetDB.updateWhere(SHEETS.CONTENT, 'content_id', contentId, {
      scheduled_at: datetime,
      status: 'approved'
    });
    return { scheduled: true };
  });
}

/** Isi kalender untuk satu bulan (format yyyy-MM). */
function apiGetCalendar(month) {
  return wrap_('apiGetCalendar', function () {
    month = month || Util.currentMonth();
    const content = {};
    SheetDB.getRows(SHEETS.CONTENT).forEach(function (r) {
      content[r.content_id] = r;
    });

    const entries = SheetDB.getRows(SHEETS.PUBLISH_LOG)
      .filter(function (r) { return String(r.scheduled_at || '').indexOf(month) === 0; })
      .map(function (r) {
        const c = content[r.content_id] || {};
        return {
          log_id: r.log_id,
          content_id: r.content_id,
          platform: r.platform,
          scheduled_at: String(r.scheduled_at),
          status: r.status,
          pillar: c.pillar || '',
          format: c.format || '',
          topic: c.topic || '',
          thumb: c.drive_file_id ? ('https://drive.google.com/thumbnail?id=' + c.drive_file_id + '&sz=w200') : ''
        };
      });

    const ready = SheetDB.getRows(SHEETS.CONTENT)
      .filter(function (r) { return r.status === 'ready'; })
      .reverse().slice(0, 50)
      .map(function (r) {
        return { content_id: r.content_id, topic: r.topic, pillar: r.pillar, format: r.format };
      });

    return { month: month, entries: entries, ready: ready };
  });
}

/* ----------------------------------------------------------------------------
 * Render ulang tanpa memanggil AI
 * -------------------------------------------------------------------------- */

/**
 * Ambil gambar mentah dari 99_Raw_AI supaya konten bisa dirender ulang
 * tanpa menghabiskan kuota AI lagi.
 *
 * SELURUH folder bulanan ditelusuri, bukan hanya bulan berjalan. Dulu
 * pencarian memakai `resolveFolder('raw', ...)` yang selalu menunjuk folder
 * bulan SEKARANG — akibatnya konten yang dibuat bulan lalu tidak pernah
 * menemukan gambar mentahnya, lalu dirender ulang di atas latar prosedural
 * tanpa satu pun pesan kesalahan. Tanggal pembuatan konten tidak bisa dipakai
 * sebagai jalan pintas: gambar mentah ikut tersimpan lagi setiap kali gambar
 * diambil ulang, jadi berkasnya bisa berada di bulan mana pun.
 */
function apiGetRawImage(contentId, index) {
  return wrap_('apiGetRawImage', function () {
    const wanted = contentId + '_raw_' + (index || 1);
    const prefix = contentId + '_raw';
    let fallback = null;

    const base = DriveStore.getOrCreateFolder(DriveStore.root(), DRIVE_FOLDERS.raw);
    const months = base.getFolders();

    while (months.hasNext()) {
      const files = months.next().getFiles();
      while (files.hasNext()) {
        const f = files.next();
        const name = f.getName();
        // Cocok persis dengan nomor halaman yang diminta: langsung pakai.
        if (name.indexOf(wanted) === 0) {
          return { dataUrl: DriveStore.readAsDataUrl(f.getId()), fileId: f.getId() };
        }
        // Halaman lain dari konten yang sama: simpan sebagai cadangan, tapi
        // teruskan mencari kalau-kalau yang persis ada di bulan berikutnya.
        if (name.indexOf(prefix) === 0 && !fallback) fallback = f;
      }
    }

    if (fallback) {
      return { dataUrl: DriveStore.readAsDataUrl(fallback.getId()), fileId: fallback.getId() };
    }
    return { dataUrl: null, fileId: '' };
  });
}

/* ----------------------------------------------------------------------------
 * Bank hashtag
 * -------------------------------------------------------------------------- */

function apiListHashtags() {
  return wrap_('apiListHashtags', function () {
    return SheetDB.getRows(SHEETS.HASHTAG_BANK).map(function (r) {
      return {
        tag: r.tag, pillar: r.pillar, tier: r.tier,
        last_used_at: String(r.last_used_at || ''), use_count: Number(r.use_count) || 0
      };
    });
  });
}

function apiAddHashtag(tag, pillar, tier) {
  return wrap_('apiAddHashtag', function () {
    const clean = Util.normalizeTag(tag);
    if (!clean) throw new Error('Hashtag kosong.');
    const exists = SheetDB.getRows(SHEETS.HASHTAG_BANK).some(function (r) {
      return Util.normalizeTag(r.tag) === clean;
    });
    if (exists) throw new Error('Hashtag "' + clean + '" sudah ada di bank.');
    SheetDB.appendRow(SHEETS.HASHTAG_BANK, {
      tag: clean, pillar: pillar || 'all', tier: tier || 'medium',
      last_used_at: '', use_count: 0
    });
    return { added: clean };
  });
}

function apiDeleteHashtag(tag) {
  return wrap_('apiDeleteHashtag', function () {
    const n = SheetDB.deleteWhere(SHEETS.HASHTAG_BANK, 'tag', Util.normalizeTag(tag));
    return { deleted: n };
  });
}

/* ----------------------------------------------------------------------------
 * Menu spreadsheet (opsional, memudahkan akses)
 * -------------------------------------------------------------------------- */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Content Engine')
      .addItem('Inisialisasi Database', 'initDatabase')
      .addToUi();
  } catch (e) {
    // Diabaikan: onOpen tidak berjalan pada konteks web app.
  }
}


/**
 * == 11 ROUTER HTTP    (dulu Api.gs)
 *
 * Endpoint HTTP untuk UI yang berjalan di luar Apps Script.
 *
 * Seluruh permintaan masuk lewat satu doPost dengan bentuk:
 *   { action: "namaAction", payload: {...}, token: "rahasia" }
 *
 * File ini lapisan tipis yang memetakan action ke fungsi api* di Main.gs.
 * Deployment ini murni API — tidak ada doGet dan tidak menyajikan HTML.
 * Antarmukanya aplikasi React yang di-host terpisah.
 *
 * Catatan CORS: Apps Script tidak bisa mengirim header Access-Control-Allow-*.
 * Karena itu klien WAJIB mengirim Content-Type: text/plain (bukan
 * application/json) supaya tidak memicu preflight OPTIONS yang tak terjawab,
 * dan token ikut di dalam body, bukan di header Authorization.
 */

/** Batas panggilan per token per jam. Mencegah kuota AI habis karena kecelakaan. */
const API_RATE_LIMIT_PER_HOUR = 120;

/**
 * Titik masuk seluruh permintaan dari UI eksternal.
 * Tidak pernah melempar exception — kegagalan apa pun dibalas sebagai JSON.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return apiJson_({ ok: false, error: 'Permintaan kosong.' });
    }

    let req;
    try {
      req = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return apiJson_({ ok: false, error: 'Body bukan JSON yang valid.' });
    }

    const auth = apiCheckToken_(req.token);
    if (!auth.ok) return apiJson_(auth);

    const limit = apiCheckRateLimit_(req.token);
    if (!limit.ok) return apiJson_(limit);

    const handler = API_ROUTES[req.action];
    if (!handler) {
      return apiJson_({ ok: false, error: 'Action tidak dikenal: ' + req.action });
    }

    // Handler memanggil fungsi api* yang sudah membungkus dirinya dengan
    // wrap_(), jadi hasilnya sudah berbentuk {ok, data} atau {ok, error}.
    return apiJson_(handler(req.payload || {}));

  } catch (err) {
    console.error('doPost gagal: ' + (err && err.stack ? err.stack : err));
    return apiJson_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

/**
 * Penanda bahwa endpoint hidup. Dipakai aplikasi React saat dibuka untuk
 * memastikan URL dan token benar sebelum memanggil action yang sesungguhnya.
 */
function apiPing() {
  return { ok: true, data: { service: 'kosa-smd-generator', time: Util.now() } };
}

/**
 * Bandingkan token dengan Script Property API_TOKEN.
 * @private
 */
function apiCheckToken_(token) {
  const expected = Config.secret('API_TOKEN');

  if (!expected) {
    return {
      ok: false,
      error: 'Script Property "API_TOKEN" belum diisi. Lihat docs/API.md.'
    };
  }
  if (!token || String(token) !== expected) {
    return { ok: false, error: 'Token tidak sah.' };
  }
  return { ok: true };
}

/**
 * Pembatas kasar per jam, memakai CacheService.
 *
 * Sengaja sederhana: tujuannya mencegah loop tak sengaja di UI menghabiskan
 * kuota AI, bukan menahan penyerang sungguhan.
 * @private
 */
function apiCheckRateLimit_(token) {
  try {
    const cache = CacheService.getScriptCache();
    // Kunci dipotong supaya token panjang tidak melewati batas panjang kunci.
    const key = 'rate:' + String(token).slice(0, 24) + ':' +
      Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHH');

    const used = Number(cache.get(key) || 0);
    if (used >= API_RATE_LIMIT_PER_HOUR) {
      return {
        ok: false,
        error: 'Terlalu banyak permintaan dalam satu jam (batas ' +
          API_RATE_LIMIT_PER_HOUR + '). Coba lagi nanti.'
      };
    }
    cache.put(key, String(used + 1), 3700);
    return { ok: true };

  } catch (err) {
    // Cache bermasalah tidak boleh memblokir pemakaian normal.
    console.warn('Rate limit dilewati: ' + err.message);
    return { ok: true };
  }
}

/**
 * Bungkus objek jadi respons JSON.
 * @private
 */
function apiJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Peta action -> fungsi api* di Main.gs.
 *
 * Menambah action baru: tambahkan satu baris di sini, lalu catat di
 * docs/API.md pada repo UI dalam commit yang sama.
 */
const API_ROUTES = {

  /* --- pengaturan & inisialisasi --- */
  ping:                apiPing,
  bootstrap:           function (p) { return apiGetBootstrap(); },
  initDatabase:        function (p) { return apiInitDatabase(); },
  saveSettings:        function (p) { return apiSaveSettings(p); },
  getQuotaStatus:      function (p) { return apiGetQuotaStatus(); },
  resetBreakers:       function (p) { return apiResetBreakers(); },
  shareAllImages:      function (p) { return apiShareAllImages(); },
  testProviders:       function (p) { return apiTestProviders(p.kind); },

  /* --- produksi konten, empat langkah terpisah --- */
  generateText:        function (p) { return apiGenerateContentText(p.format, p.pillar, p.topic, p.opts || {}); },
  fetchImage:          function (p) { return apiFetchAiImage(p.prompt, p.contentId, p.index, p.format); },
  uploadRendered:      function (p) { return apiUploadRendered(p.contentId, p.format, p.index, p.base64); },
  saveContent:         function (p) { return apiSaveContent(p); },

  /* --- ide --- */
  generateIdeas:       function (p) { return apiGenerateIdeas(p.pillar, p.count); },
  listIdeas:           function (p) { return apiListIdeas(p.pillar); },

  /* --- library & kalender --- */
  listContent:         function (p) { return apiListContent(p.filter || {}); },
  getContent:          function (p) { return apiGetContent(p.contentId); },
  updateContentStatus: function (p) { return apiUpdateContentStatus(p.contentId, p.status); },
  deleteContent:       function (p) { return apiDeleteContent(p.contentId); },
  updateCaption:       function (p) { return apiUpdateCaption(p.contentId, p.caption, p.hashtags); },
  updateSlideText:     function (p) { return apiUpdateSlideText(p.contentId, p.order, p.title, p.body); },
  saveDesign:          function (p) { return apiSaveDesign(p.contentId, p.design); },
  uploadLogo:          function (p) { return apiUploadLogo(p.base64, p.mimeType); },
  getLogo:             function (p) { return apiGetLogo(); },
  removeLogo:          function (p) { return apiRemoveLogo(); },
  schedulePublish:     function (p) { return apiSchedulePublish(p.contentId, p.platform, p.datetime); },
  getCalendar:         function (p) { return apiGetCalendar(p.month); },
  getRawImage:         function (p) { return apiGetRawImage(p.contentId, p.index); },

  /* --- bank hashtag --- */
  listHashtags:        function (p) { return apiListHashtags(); },
  addHashtag:          function (p) { return apiAddHashtag(p.tag, p.pillar, p.tier); },
  deleteHashtag:       function (p) { return apiDeleteHashtag(p.tag); }
};
