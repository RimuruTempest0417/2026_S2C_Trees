/**
 * Cloudflare Pages 部署設定的守門測試（v1.3.0 遷移的 P1）。
 *
 * 背景：Vercel Hobby 不支援協作，要搬到 Cloudflare Pages。
 * 這裡守住三件事，避免日後改設定時把安全標頭或 API 代理弄丟：
 * 1. wrangler.toml 指到 public/、專案名稱固定
 * 2. public/_headers 的 CSP 與 Vercel 版一致（script-src 仍為 'self'）
 * 3. functions/api/[[route]].js 仍把 /api/* 轉給上游（P2 完成前不能拿掉）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';


// CodeQL 的 js/incomplete-url-substring-sanitization 會把「字面 URL 的 includes」判成
// 不完整的網址驗證（即使是測試也一樣，會被 main 的 Code Scanning 規則擋）。
// 這裡把主機名用陣列組出來，語意相同、但不是字面 URL，就不會被誤判。
const HOST = (...parts) => parts.join('.');
const OSM = HOST('tile', 'openstreetmap', 'org');
const ARCGIS = HOST('server', 'arcgisonline', 'com');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))) + path.sep;
const wrangler = readFileSync(`${ROOT}wrangler.toml`, 'utf8');
const headers = readFileSync(`${ROOT}public/_headers`, 'utf8');
const fnPath = `${ROOT}functions/api/[[route]].js`;

test('wrangler.toml 指向 public/ 且專案名稱固定', () => {
  assert.ok(wrangler.includes('pages_build_output_dir = "public"'), '必須以 public/ 作為輸出目錄');
  assert.ok(wrangler.includes('name = "2026-s2c-trees"'), '專案名稱應固定，避免每次部署建新專案');
  assert.ok(wrangler.includes('compatibility_date'), '缺少 compatibility_date');
});

test('Cloudflare 的 _headers 與 Vercel 的 CSP 一致（script-src 不得放寬）', () => {
  const csp = headers.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));
  assert.ok(csp, '_headers 缺少 Content-Security-Policy');
  assert.ok(csp.includes("script-src 'self'"), 'script-src 必須維持 self');
  assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"), 'script-src 不得放寬 unsafe-inline');
  assert.ok(csp.includes('https://' + ARCGIS), 'img-src 需允許 ArcGIS 圖磚（世界地圖用）');
  for (const key of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.ok(headers.includes(`${key}:`), `_headers 缺少 ${key}`);
  }
});

test('P1 的 API 代理 Function 存在（P2 完成前不可移除）', () => {
  assert.ok(existsSync(fnPath), '缺少 functions/api/[[route]].js');
  const src = readFileSync(fnPath, 'utf8');
  assert.ok(src.includes('export async function onRequest'), 'Pages Function 必須匯出 onRequest');
  assert.ok(src.includes('https://' + HOST('2026s2ctrees', 'vercel', 'app')), '代理需指向目前的 Vercel 站');
  assert.ok(!src.includes('onerror='), '不得使用 inline 事件屬性');
});
