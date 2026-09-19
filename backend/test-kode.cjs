/**
 * test-kode.js — Membuktikan Kode.gs gabungan benar-benar bisa dijalankan.
 *
 * Penggabungan 11 modul jadi satu berkas punya dua risiko yang tidak terlihat
 * dari membaca kode: urutan `const` yang salah (const tidak ter-hoist, jadi
 * modul yang dipakai duluan harus berada di atas) dan nama yang bentrok.
 * Keduanya baru muncul sebagai ReferenceError saat dijalankan.
 *
 * Tes ini memuat Kode.gs apa adanya ke sandbox berisi tiruan layanan Google,
 * lalu menembak doPost persis seperti aplikasi React melakukannya.
 *
 *   node test-kode.js     -> exit 0 kalau lolos, 1 kalau gagal
 *
 * Tidak menyentuh jaringan, spreadsheet asli, maupun kuota AI.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require(path.join(__dirname, '..', '..', 'tests', 'harness.js'));

const sandbox = H.makeSandbox(() => {
  throw new Error('Tes ini tidak boleh memanggil jaringan.');
});

let pass = 0, fail = 0;

function checkThat(label, cond, info) {
  if (cond) { pass++; console.log('  ok   ' + label + (info ? '  -> ' + info : '')); }
  else { fail++; console.log('  GAGAL ' + label + (info ? '  -> ' + info : '')); }
}

/* ------------------------------------------------ 1. berkas bisa dimuat */

console.log('\n--- MEMUAT Kode.gs ---');

const src = fs.readFileSync(path.join(__dirname, 'Kode.gs'), 'utf8');
try {
  vm.runInContext(src, sandbox, { filename: 'Kode.gs' });
  pass++;
  console.log('  ok   Kode.gs dimuat tanpa error urutan/duplikat');
} catch (e) {
  console.log('  GAGAL Kode.gs tidak bisa dimuat -> ' + e.message);
  console.log('\nBiasanya ini berarti urutan bagian tertukar. Bagian 1');
  console.log('(KONFIGURASI) wajib paling atas.\n');
  process.exit(1);
}

const evalIn = code => vm.runInContext(code, sandbox);

/* ------------------------------------- 2. seluruh modul benar-benar ada */

console.log('\n--- MODUL ---');

['Config', 'Util', 'SheetDB', 'Quota', 'PromptBuilder', 'AiImage', 'AiText',
 'DriveStore', 'Pipeline'].forEach(function (name) {
  checkThat('modul ' + name + ' terdefinisi',
    evalIn('typeof ' + name) === 'object');
});

checkThat('initDatabase() ada', evalIn('typeof initDatabase') === 'function');
checkThat('wrap_() ada', evalIn('typeof wrap_') === 'function');

/* ------------------------------------------ 3. tidak ada sisa UI lama */

console.log('\n--- BACKEND MURNI API ---');

checkThat('doGet sudah tidak ada',
  evalIn('typeof doGet') === 'undefined',
  'backend ini tidak boleh menyajikan HTML');

checkThat('include() sudah tidak ada',
  evalIn('typeof include') === 'undefined');

checkThat('tidak ada jejak HtmlService',
  src.indexOf('HtmlService') === -1,
  'HtmlService hanya dipakai UI Apps Script lama');

/* ------------------------------------------------------ 4. router hidup */

console.log('\n--- ROUTER doPost ---');

const TOKEN = 'token-rahasia-untuk-pengujian-123456';
H.setProps(sandbox, { API_TOKEN: TOKEN });
evalIn('Config.invalidate()');

function post(body) {
  sandbox._postBody = typeof body === 'string' ? body : JSON.stringify(body);
  return JSON.parse(evalIn('doPost({ postData: { contents: _postBody } })').getContent());
}

checkThat('doPost terdefinisi', evalIn('typeof doPost') === 'function');

const pong = post({ action: 'ping', token: TOKEN });
checkThat('ping dengan token benar -> ok', pong.ok === true,
  JSON.stringify(pong.data));

checkThat('token salah ditolak',
  post({ action: 'ping', token: 'salah' }).error === 'Token tidak sah.');

checkThat('action tidak dikenal dibalas JSON, bukan exception',
  post({ action: 'ngawur', token: TOKEN }).error.indexOf('ngawur') !== -1);

checkThat('body rusak dibalas JSON, bukan exception',
  post('{bukan json').ok === false);

/* ------------- 5. tiap action yang dipanggil React punya handler nyata */

console.log('\n--- KELENGKAPAN ACTION ---');

/*
 * Daftar action dibaca langsung dari kode React, bukan ditulis ulang di sini.
 *
 * Daftar salinan harus disinkronkan setiap kali UI menambah pemanggilan, dan
 * itu justru yang paling mudah terlewat — action baru lolos tes lalu gagal di
 * tangan pengguna. Membacanya dari sumber membuat tes ikut tahu dengan
 * sendirinya.
 */
const API_DIR = path.join(__dirname, '..', 'src', 'api');

const DIPAKAI_UI = (function () {
  const found = new Set();
  fs.readdirSync(API_DIR)
    .filter(function (f) { return f.endsWith('.ts') && !f.endsWith('.test.ts'); })
    .forEach(function (f) {
      const src = fs.readFileSync(path.join(API_DIR, f), 'utf8');
      // call<T>('namaAction', ...) — tanda kutip tunggal maupun ganda.
      const re = /\bcall\s*(?:<[^>]*>)?\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;
      let m;
      while ((m = re.exec(src)) !== null) found.add(m[1]);
    });
  return Array.from(found).sort();
})();

checkThat('daftar action terbaca dari src/api/',
  DIPAKAI_UI.length > 0,
  DIPAKAI_UI.length + ' action ditemukan');

const hilang = DIPAKAI_UI.filter(function (a) {
  return evalIn('typeof API_ROUTES[' + JSON.stringify(a) + ']') !== 'function';
});

checkThat('seluruh ' + DIPAKAI_UI.length + ' action yang dipakai UI punya handler',
  hilang.length === 0,
  hilang.length ? 'hilang: ' + hilang.join(', ') : 'lengkap');

// Tiap handler harus menunjuk fungsi api* yang benar-benar ada, bukan nama
// yang salah ketik — itu baru ketahuan saat action dipanggil pengguna.
const rusak = evalIn(
  'Object.keys(API_ROUTES).filter(function (k) {' +
  '  return typeof API_ROUTES[k] !== "function";' +
  '})'
);
checkThat('tidak ada rute yang menunjuk fungsi tidak ada',
  rusak.length === 0, rusak.length ? rusak.join(', ') : 'semua rute valid');

/* --------------------------------------------------------------- ringkasan */

console.log('\n' + '='.repeat(58));
console.log('  lolos: ' + pass + '   gagal: ' + fail);
console.log('='.repeat(58) + '\n');

process.exit(fail === 0 ? 0 : 1);
