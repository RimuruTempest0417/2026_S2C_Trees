/**
 * 合作專題（世界地圖頁）的守門測試。
 *
 * 背景：老師要求把兩個人的作品合併。同學的版本是單檔 index.html（419KB，內嵌 354KB script），
 * 直接搬進來會被本站嚴格的 CSP（script-src 'self'）擋掉整頁 JS，而且無法被瀏覽器快取。
 *
 * 因此併入時做了三件事，這裡逐項守住：
 * 1. 內嵌 script 抽成 public/partner/app.js，HTML 只用外鏈載入
 * 2. HTML 與 app.js 產生的字串都不得出現 inline 事件屬性（onclick= 等），否則 CSP 會擋
 * 3. ArcGIS 線上圖磚（server.arcgisonline.com）必須列在 vercel.json 的 img-src
 *
 * 注意：這裡刻意不用「長得像 HTML 過濾器」的正則（例如 <script[^>]*> 這種寫法），
 * 因為 CodeQL 的 js/bad-tag-filter 會把它判成過濾器並報 high，讓 PR 被分支規則擋下。
 * 一律改用字串切分與 includes 比對。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const PARTNER = `${ROOT}public/partner`;
const html = readFileSync(`${PARTNER}/index.html`, 'utf8');
const js = readFileSync(`${PARTNER}/app.js`, 'utf8');
const vercel = JSON.parse(readFileSync(`${ROOT}vercel.json`, 'utf8'));
const shell = readFileSync(`${ROOT}public/index.html`, 'utf8');

const HANDLER_NAMES = ['onclick', 'onload', 'onerror', 'onchange', 'oninput', 'onsubmit', 'onmouseover', 'ontouchstart'];

/** 用字串比對找出 inline 事件屬性（避免使用 HTML 樣式的正則） */
function findInlineHandlers(text) {
  const lower = text.toLowerCase();
  const hits = [];
  for (const name of HANDLER_NAMES) {
    const needle = ` ${name}=`;
    let i = lower.indexOf(needle);
    while (i !== -1) {
      hits.push(text.slice(i + 1, i + 1 + name.length + 1));
      i = lower.indexOf(needle, i + 1);
    }
  }
  return hits;
}

/** 取出所有 script 開頭標籤（用切分，不用正則） */
function scriptTags(text) {
  return text.split('<script').slice(1).map((p) => p.slice(0, p.indexOf('>') + 1));
}

test('合作專題頁存在，且內嵌 script 已抽出成 app.js', () => {
  assert.ok(existsSync(`${PARTNER}/index.html`), '缺少 public/partner/index.html');
  assert.ok(existsSync(`${PARTNER}/app.js`), '缺少 public/partner/app.js');
  const tags = scriptTags(html);
  assert.equal(tags.length, 1, `partner/index.html 應該只有 1 個 script 標籤，實際 ${tags.length} 個`);
  assert.ok(tags[0].includes('src="./app.js"'), 'script 標籤必須用外鏈載入 app.js');
  assert.ok(statSync(`${PARTNER}/app.js`).size > 300_000, 'app.js 太小，內嵌程式可能沒抽出來');
});

test('合作專題頁不得有 inline 事件屬性（CSP script-src \'self\' 會擋）', () => {
  const inline = findInlineHandlers(html);
  assert.equal(inline.length, 0, `發現 ${inline.length} 個 inline 事件屬性：${inline.join('、')}`);
});

test('合作專題的程式不得「產生」inline 事件屬性（innerHTML 字串裡的 onerror 也一樣會被擋）', () => {
  // 曾發生：HTML 檔本身乾淨，但 app.js 用 innerHTML 組出 onerror="imgFix(...)"，
  // 真實 CSP 下每張卡片都報 "Executing inline event handler violates..."。
  const offenders = findInlineHandlers(js).filter((h) => h.endsWith('="'));
  assert.equal(offenders.length, 0, `app.js 產生 inline 事件屬性：${offenders.join('、')}`);
  assert.ok(js.includes("addEventListener('error'"), '缺少圖片錯誤的委派監聽');
  assert.ok(js.includes('data-fix='), '缺少 data-fix 標記');
});

test('ArcGIS 圖磚網域必須列在 CSP img-src，否則世界地圖會空白', () => {
  const csp = vercel.headers
    .flatMap((h) => h.headers)
    .find((x) => x.key === 'Content-Security-Policy').value;
  const imgSrc = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('img-src'));
  assert.ok(imgSrc, 'vercel.json 找不到 img-src');
  assert.ok(imgSrc.includes('https://server.arcgisonline.com'), 'img-src 少了 server.arcgisonline.com');
  // script-src 仍必須嚴格：不能為了合併放寬 inline script
  assert.ok(csp.includes("script-src 'self'"), 'script-src 必須是 self');
  assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"), 'script-src 不可以放寬 unsafe-inline');
});

test('657 張照片都在，且主站有入口連到 /partner/', () => {
  const photos = readdirSync(`${PARTNER}/相片`).filter((f) => f.endsWith('.jpg'));
  assert.equal(photos.length, 657, `照片數量應為 657，實際 ${photos.length}`);
  assert.ok(shell.includes('href="/partner/"'), '主站導覽列沒有連到 /partner/ 的入口');
});

test('合作專題頁不得出現「作業」二字（介面鐵律）', () => {
  for (const [name, text] of [['index.html', html], ['app.js', js]]) {
    assert.ok(!text.includes('作業'), `partner/${name} 出現「作業」二字`);
  }
});
