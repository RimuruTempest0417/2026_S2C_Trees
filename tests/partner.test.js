/**
 * 合作專題（世界地圖頁）的守門測試。
 *
 * 背景：老師要求把兩個人的作品合併。同學的版本是單檔 index.html（419KB，內嵌 354KB script），
 * 直接搬進來會被本站嚴格的 CSP（script-src 'self'）擋掉整頁 JS，而且無法被瀏覽器快取。
 *
 * 因此併入時做了三件事，這裡逐項守住：
 * 1. 內嵌 script 抽成 public/partner/app.js，HTML 只用外鏈載入
 * 2. HTML 不得出現 inline 事件屬性（onclick= 等），否則 CSP 一樣會擋
 * 3. ArcGIS 線上圖磚（server.arcgisonline.com）必須列在 vercel.json 的 img-src
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

test('合作專題頁存在，且內嵌 script 已抽出成 app.js', () => {
  assert.ok(existsSync(`${PARTNER}/index.html`), '缺少 public/partner/index.html');
  assert.ok(existsSync(`${PARTNER}/app.js`), '缺少 public/partner/app.js');
  // 只能有一個 script 標籤，而且是外鏈
  const tags = html.match(/<script\b[^>]*>/g) || [];
  assert.equal(tags.length, 1, `partner/index.html 應該只有 1 個 script 標籤，實際 ${tags.length} 個`);
  assert.match(tags[0], /src="\.\/app\.js"/);
  // app.js 要真的裝著原本的程式（不是空檔）
  assert.ok(statSync(`${PARTNER}/app.js`).size > 300_000, 'app.js 太小，內嵌程式可能沒抽出來');
});

test('合作專題頁不得有 inline 事件屬性（CSP script-src \'self\' 會擋）', () => {
  const inline = html.match(/\son(?:click|load|error|change|input|submit|mouse\w+|touch\w+)\s*=/gi) || [];
  assert.equal(inline.length, 0, `發現 ${inline.length} 個 inline 事件屬性：${inline.join('、')}`);
});

test('ArcGIS 圖磚網域必須列在 CSP img-src，否則世界地圖會空白', () => {
  const csp = vercel.headers
    .flatMap((h) => h.headers)
    .find((x) => x.key === 'Content-Security-Policy').value;
  const imgSrc = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('img-src'));
  assert.ok(imgSrc, 'vercel.json 找不到 img-src');
  assert.match(imgSrc, /https:\/\/server\.arcgisonline\.com/, 'img-src 少了 server.arcgisonline.com');
  // script-src 仍必須嚴格：不能為了合併放寬 inline script
  const scriptSrc = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('script-src') || s.startsWith('default-src'));
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/, 'script-src 不可以放寬 unsafe-inline');
  assert.ok(scriptSrc);
});

test('657 張照片都在，且主站有入口連到 /partner/', () => {
  const photos = readdirSync(`${PARTNER}/相片`).filter((f) => f.endsWith('.jpg'));
  assert.equal(photos.length, 657, `照片數量應為 657，實際 ${photos.length}`);
  assert.match(shell, /href="\/partner\/"/, '主站導覽列沒有連到 /partner/ 的入口');
});

test('合作專題頁不得出現「作業」二字（介面鐵律）', () => {
  for (const [name, text] of [['index.html', html], ['app.js', js]]) {
    assert.ok(!text.includes('作業'), `partner/${name} 出現「作業」二字`);
  }
});
