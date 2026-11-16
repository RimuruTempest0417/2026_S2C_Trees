import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sv = readFileSync(new URL('../public/js/streetview.js', import.meta.url), 'utf8');
const map = readFileSync(new URL('../public/js/map.js', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('streetview.js：embed 網址用 Google 官方 /maps/embed 格式，且靠座標自動取全景', () => {
  assert.match(sv, /https:\/\/www\.google\.com\/maps\/embed\?pb=/, '必須用 Google 官方 embed 端點');
  // 關鍵：!1s0x0:0x0 讓 Google 依座標自己找最近的全景，才不必為 658 株樹逐一存 pano id
  assert.ok(sv.includes('!1s0x0:0x0'), '缺少 !1s0x0:0x0（座標自動定位的關鍵參數）');
  assert.ok(sv.includes('!6m8'), '缺少 !6m8（街景模式；沒有它會變成地圖）');
  assert.ok(sv.includes('!1d'), '缺少緯度參數 !1d');
  assert.ok(sv.includes('!2d'), '缺少經度參數 !2d');
});

test('streetview.js：不開新分頁、不引入外部 script', () => {
  assert.ok(!/target="_blank"/.test(sv), '街景不得用新分頁開啟');
  assert.ok(!/<script/i.test(sv), '不得注入外部 script');
});

test('map.js：街景按鈕走頁面內面板，不帶 href 外連', () => {
  assert.ok(map.includes("from './streetview.js'"), '必須引用 streetview 模組');
  assert.ok(map.includes('data-act="streetview"'), '缺少街景按鈕');
  assert.ok(!/maps\.google\.com|google\.com\/maps\/@\?api=1/.test(map), 'map.js 不應再出現外部 Google 地圖連結');
});

test('CSP 允許 Google 嵌入（frame-src），且仍禁止本頁被別人嵌入', () => {
  const csp = vercel.headers
    .flatMap((h) => h.headers)
    .find((h) => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /frame-src[^;]*https:\/\/www\.google\.com/, 'frame-src 必須放行 www.google.com');
  assert.match(csp, /frame-ancestors 'none'/, 'frame-ancestors 仍必須是 none');
});

test('頁面有 Google 地圖的引用說明', () => {
  assert.match(map, /街景嵌入使用 Google 地圖/, '缺少 Google 地圖使用聲明');
});
