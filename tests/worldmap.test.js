/**
 * 世界地圖（世界 → 珠三角 → 澳門）的守門測試。
 *
 * 這頁地圖是將合作組員的 SVG pan/zoom 作品併進本站後重寫的版本，因此測試守住：
 * 1. 地理資料檔存在且數量正確（119 國、8 堂區），堂區座標落在澳門範圍
 * 2. worldmap.js 真的匯出 createWorldMap，且具備完整 API 與 Web Mercator 投影
 * 3. 地圖查詢頁有「世界地圖／平面地圖」切換，且切換時會銷毀 SVG
 * 4. 不得出現行內事件屬性（CSP script-src 'self' 會直接擋掉整段 JS）
 * 5. 不得引入 CDN 或新套件；index.html 不能被改壞
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))) + path.sep;
const GEO_PATH = `${ROOT}public/data/world-geo.json`;
const worldmap = readFileSync(`${ROOT}public/js/worldmap.js`, 'utf8');
const mapJs = readFileSync(`${ROOT}public/js/map.js`, 'utf8');
const css = readFileSync(`${ROOT}public/css/style.css`, 'utf8');
const html = readFileSync(`${ROOT}public/index.html`, 'utf8');
const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8'));

const HANDLER_NAMES = ['onclick', 'onload', 'onerror', 'onchange', 'oninput', 'onsubmit', 'onmouseover', 'ontouchstart'];

/** 用字串比對找出行內事件屬性（避免用 HTML 樣式的正則，CodeQL 會誤判成過濾器） */
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

test('world-geo.json 可解析，收錄 119 國、8 個堂區與珠三角輪廓', () => {
  assert.ok(existsSync(GEO_PATH), '缺少 public/data/world-geo.json');
  assert.ok(statSync(GEO_PATH).size > 50_000, '地理資料檔太小，可能抽取不完整');
  const geo = JSON.parse(readFileSync(GEO_PATH, 'utf8'));
  assert.equal(geo.world.length, 119, `world 應為 119 筆，實際 ${geo.world.length}`);
  assert.equal(geo.parishes.length, 8, `parishes 應為 8 筆，實際 ${geo.parishes.length}`);
  assert.ok(Array.isArray(geo.prd) && geo.prd.length > 0, '缺少 prd 珠三角輪廓');

  for (const c of geo.world) {
    assert.equal(typeof c.n, 'string');
    assert.ok(Array.isArray(c.r) && c.r.length, `${c.n} 沒有輪廓`);
  }
  for (const p of geo.parishes) {
    assert.equal(typeof p.n, 'string');
    assert.ok(Array.isArray(p.o) && p.o.length, `${p.n} 沒有外環`);
    for (const ring of p.o) {
      assert.ok(ring.length >= 3, `${p.n} 的環少於 3 點`);
      for (const [lon, lat] of ring) {
        assert.ok(lon > 113.4 && lon < 113.7, `${p.n} 經度超出澳門範圍：${lon}`);
        assert.ok(lat > 22.0 && lat < 22.3, `${p.n} 緯度超出澳門範圍：${lat}`);
      }
    }
  }
});

test('worldmap.js 匯出 createWorldMap（模組本身不依賴 DOM，可直接 import）', async () => {
  const mod = await import(pathToFileURL(`${ROOT}public/js/worldmap.js`).href);
  assert.deepEqual(Object.keys(mod), ['createWorldMap']);
  assert.equal(typeof mod.createWorldMap, 'function');
});

test('世界地圖 API 完整，並以 Web Mercator ＋ <g> transform 做 pan/zoom', () => {
  assert.match(worldmap, /export function createWorldMap\(container, options = \{\}\)/);
  for (const name of ['destroy', 'setTrees', 'focusTree', 'focusMacau', 'reset']) {
    assert.ok(worldmap.includes(name), `缺少 ${name}()`);
  }
  assert.match(worldmap, /return \{ destroy, setTrees, focusTree, focusMacau, reset \};/);

  assert.match(worldmap, /Math\.log\(Math\.tan/, '缺少 Web Mercator 投影公式');
  assert.ok(worldmap.includes("space.setAttribute('transform'"), '縮放應只改 <g> 的 transform');
  assert.ok(worldmap.includes("addEventListener('wheel'"), '缺少滾輪縮放');
  assert.ok(worldmap.includes("addEventListener('dblclick'"), '缺少雙擊放大');
  assert.ok(worldmap.includes("addEventListener('pointermove'"), '缺少拖曳平移');
  assert.ok(worldmap.includes('data-wm-tree'), '樹點缺少 data-wm-tree 標記');
  assert.ok(worldmap.includes("createElementNS(NS, 'title')"), '樹點缺少 <title> 提示');
  assert.match(worldmap, /#\$\{no\} \$\{t\.species \|\| '古樹'\} · \$\{age\}/, '<title> 應為「#樹號 樹種 · 樹齡」');
  assert.ok(worldmap.includes("if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;"), '缺座標的樹應跳過');
  // 迴歸：曾把 r 直接寫成「px ÷ 縮放」，高倍率下 r≈4e-7 會被 Chrome 算成 0，
  // 整個街區級看不到任何樹點。改為固定 px 半徑＋scale(1/s) 後才正確。
  assert.ok(worldmap.includes("item.el.setAttribute('r', String(px))"), '圓點半徑應為固定 px');
  assert.ok(worldmap.includes('scale(${inv})'), '圓點應以 scale(1/s) 抵銷外層縮放');
});

test('世界地圖與地圖頁都不得有行內事件屬性（CSP script-src \'self\' 會擋）', () => {
  for (const [name, text] of [['worldmap.js', worldmap], ['map.js', mapJs], ['index.html', html]]) {
    const hits = findInlineHandlers(text);
    assert.equal(hits.length, 0, `${name} 發現行內事件屬性：${hits.join('、')}`);
  }
});

test('worldmap.js 不引入 CDN、不新増套件，也不使用 innerHTML', () => {
  assert.ok(!worldmap.includes('<script'), '不得插入 script 標籤');
  assert.ok(!worldmap.includes('https://'), '不得引入外部 CDN 資源');
  assert.ok(!worldmap.includes('.innerHTML'), '世界地圖應以 DOM API 建立節點');
  const deps = Object.keys(pkg.dependencies || {});
  assert.deepEqual(deps.sort(), ['@neondatabase/serverless', '@vercel/blob'], '不得新增執行期套件');
});

test('地圖查詢頁提供 [世界地圖 | 平面地圖] 切換，並接上既有詳情彈窗', () => {
  assert.ok(mapJs.includes('世界地圖'), '缺少「世界地圖」切換字樣');
  assert.ok(mapJs.includes('平面地圖'), '缺少「平面地圖」切換字樣');
  assert.ok(mapJs.includes("from './worldmap.js'"), 'map.js 沒有匯入世界地圖模組');
  assert.match(mapJs, /createWorldMap\(wmBox, \{/, '沒有掛載世界地圖');
  assert.ok(mapJs.includes('state.wm.setTrees(state.trees)'), '篩選後沒有同步樹點');
  assert.ok(mapJs.includes('onSelect: (no) => { showDetail(no); }'), '點樹點沒有打開本站詳情');
  assert.ok(mapJs.includes('state.wm.destroy()'), '切回平面地圖時沒有銷毀 SVG');
  assert.ok(mapJs.includes('map.invalidateSize()'), '切回 Leaflet 時沒有重算尺寸');
  assert.ok(mapJs.includes('data-map-mode'), '缺少分段切換按鈕');
});

test('世界地圖樣式存在，顏色沿用既有 CSS 變數', () => {
  for (const sel of ['.map-mode', '.map-stage', '.worldmap', '.wm-svg', '.wm-country', '.wm-prd', '.wm-parish', '.wm-tree', '.wm-controls', '.wm-btn', '.wm-legend']) {
    assert.ok(css.includes(sel), `缺少樣式 ${sel}`);
  }
  const block = css.slice(css.indexOf('/* ── 世界地圖'), css.indexOf('/* ── 路綫'));
  assert.ok(block.includes('var(--card)'), '應使用 --card');
  assert.ok(block.includes('var(--line)'), '應使用 --line');
  assert.ok(block.includes('var(--ink'), '應使用 --ink 系列文字色');
  assert.ok(block.includes('var(--green-'), '應使用既有綠色系');
  assert.ok(block.includes('vector-effect: non-scaling-stroke'), '縮放時邊線寬度應保持固定');
});

test('index.html 未被改壞：模組入口、檢視容器與彈窗都還在', () => {
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.trimEnd().endsWith('</html>'));
  for (const id of ['view-map', 'modal', 'modal-body', 'toast', 'main']) {
    assert.ok(html.includes(`id="${id}"`), `缺少 #${id}`);
  }
  assert.ok(html.includes('<script type="module" src="/js/app.js"></script>'), '缺少模組入口');
  // v1.2.0 起合作專題已整併進地圖頁，不應再有 /partner/ 的獨立入口
  assert.ok(!html.includes('href="/partner/"'), '不應保留 /partner/ 獨立入口');
  const tags = html.split('<script').slice(1).map((p) => p.slice(0, p.indexOf('>') + 1));
  assert.ok(tags.every((t) => t.includes('src=')), 'index.html 不應出現內嵌 script');
});
