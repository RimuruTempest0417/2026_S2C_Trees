/**
 * 專題導覽（#/story）的守門測試。
 *
 * 這一頁把合作組員的六章敘事併進本站，但圖表改成原生 SVG、數字改成執行時
 * 從 /api/trees 重算。測試守住：
 * 1. 路由、導覽列、view 容器與 app.js 的 TITLES 都已註冊
 * 2. 六個章節標題都在，且每章都有「進一步查看」連結
 * 3. 圖表是 SVG（含正確命名空間），不是 canvas；不得有行內事件屬性（CSP 會擋）
 * 4. 不得引入 CDN 或新套件；統計值不得寫死在原始碼
 * 5. 直方圖與相關係數的純函式行為正確
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = `${path.dirname(path.dirname(fileURLToPath(import.meta.url)))}${path.sep}`;
const story = readFileSync(`${ROOT}public/js/story.js`, 'utf8');
const app = readFileSync(`${ROOT}public/js/app.js`, 'utf8');
const html = readFileSync(`${ROOT}public/index.html`, 'utf8');
const css = readFileSync(`${ROOT}public/css/style.css`, 'utf8');
const sw = readFileSync(`${ROOT}public/sw.js`, 'utf8');

const HANDLER_NAMES = ['onclick', 'onload', 'onerror', 'onchange', 'oninput', 'onsubmit', 'onmouseover', 'ontouchstart'];

/** 用字串比對找行內事件屬性（避免用 HTML 樣式的正則，CodeQL 會誤判成過濾器） */
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

test('story 分頁已註冊：VIEWS、TITLES、導覽列、view 容器', () => {
  assert.match(app, /^\s{2}story: \(\) => import\('\.\/story\.js'\),$/m);
  assert.match(app, /^\s{2}story: '專題導覽',$/m);
  assert.match(html, /<a class="tab" href="#\/story" data-view="story">專題導覽<\/a>/);
  assert.match(html, /<section class="view" id="view-story" hidden><\/section>/);

  // 依要求放在「保育科普」之後
  assert.ok(html.indexOf('data-view="knowledge"') < html.indexOf('data-view="story"'),
    '「專題導覽」應排在「保育科普」之後');
});

test('story.js 匯出 render，介面與其他檢視相同', async () => {
  const mod = await import(pathToFileURL(`${ROOT}public/js/story.js`).href);
  assert.equal(typeof mod.render, 'function');
  assert.equal(typeof mod.histogram, 'function');
  assert.equal(typeof mod.groupCount, 'function');
  assert.equal(typeof mod.pearson, 'function');
});

test('六章標題齊全，且每章都有「進一步查看」', () => {
  const titles = ['各堂區古樹數目分佈', '樹種結構', '樹齡結構與樹高結構', '健康狀況與保護級別', '古樹圖鑑', '資料來源'];
  for (const title of titles) assert.ok(story.includes(title), `缺少章節標題：${title}`);

  const chapters = [...story.matchAll(/const ch\d = chapter\(\d,/g)].map((m) => m[0]);
  assert.equal(chapters.length, 6, `應有六章，實際 ${chapters.length}`);
  assert.equal((story.match(/id="story-s\$\{no\}"/g) || []).length, 1, '章節錨點應由章號產生');
  assert.match(story, /<strong>進一步查看：<\/strong>/, '缺少「進一步查看」連結區');
});

test('圖表用原生 SVG（正確命名空間），不是 canvas', () => {
  assert.match(story, /const SVG_NS = 'http:\/\/www\.w3\.org\/2000\/svg';/);
  assert.match(story, /xmlns="\$\{SVG_NS\}"/);
  assert.match(story, /viewBox="0 0 \$\{width\} \$\{height\}"/);
  assert.ok(!/<canvas/.test(story), 'story.js 不應使用 canvas（本站圖表以 SVG 自繪）');
  assert.ok(!/new window\.Chart|window\.Chart/.test(story), '不應依賴 Chart.js');
  assert.match(css, /\.story-svg \{[^}]*display: block[^}]*width: 100%[^}]*height: auto/);
});

test('沒有行內事件屬性（CSP script-src \'self\' 會直接擋掉）', () => {
  assert.deepEqual(findInlineHandlers(story), []);
  assert.deepEqual(findInlineHandlers(html.split('id="view-story"')[1] || ''), []);
  // 互動一律靠 data-* 屬性 ＋ 事件委派
  assert.match(story, /addEventListener\('click'/);
});

test('沒有 CDN／外部腳本／新套件', () => {
  for (const bad of ['<script', 'cdn.', 'unpkg', 'jsdelivr', 'googleapis', '@import', 'require(']) {
    assert.ok(!story.includes(bad), `story.js 不應出現 ${bad}`);
  }
  assert.ok(!/https?:\/\/[^"']+\.(?:js|css)(?=["'?#])/.test(story), 'story.js 不應載入外部 JS／CSS');
});

test('統計值不得寫死：只留官方引用，其餘由資料計算', () => {
  // 合作組員原文的關鍵統計值：若出現在原始碼，代表沒有改成執行時計算
  for (const hardcoded of ['658', '54.1', '30.1', '99.2', '3.2%', '653 棵', '21 棵']) {
    assert.ok(!story.includes(hardcoded), `story.js 出現寫死的統計值：${hardcoded}`);
  }
  assert.match(story, /api\.trees\(\{ limit: 2000 \}\)/);
  assert.match(story, /cached\('story:trees'/);
  assert.match(story, /errText\(err\)/, '載入失敗時必須用 errText() 顯示原因');
  assert.match(story, /第 279\/2025 號行政長官批示/, '官方出處應保留可回查的引用');
});

test('直方圖分組與相關係數的純函式正確', async () => {
  const { histogram, groupCount, pearson } = await import(pathToFileURL(`${ROOT}public/js/story.js`).href);

  const bins = histogram([1, 24, 25, 49, 50], 25);
  assert.deepEqual(bins.map((b) => [b.start, b.end, b.count]), [[0, 24, 2], [25, 49, 2], [50, 74, 1]]);

  // 最後一組必須包含最大值（515 年要落在 500–524）
  const ages = histogram([515], 25);
  assert.equal(ages[ages.length - 1].start, 500);
  assert.equal(ages[ages.length - 1].end, 524);
  assert.equal(ages[ages.length - 1].count, 1);

  assert.deepEqual(groupCount([{ p: 'A' }, { p: 'A' }, { p: 'B' }], 'p'), [
    { label: 'A', value: 2 }, { label: 'B', value: 1 },
  ]);

  assert.ok(Math.abs(pearson([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12);
  assert.ok(Math.abs(pearson([1, 2, 3, 4], [8, 6, 4, 2]) + 1) < 1e-12);
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), null);
});

test('新模組已列入 Service Worker 預載清單', () => {
  assert.ok(sw.includes("'/js/story.js'"), 'public/sw.js 缺少 /js/story.js，離線時這一頁會白畫面');
});
