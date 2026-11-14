/**
 * 世界地圖 → 珠江三角洲 → 澳門 → 單棵古樹 的 SVG 互動地圖。
 *
 * 設計取捨：
 * 1. 幾何一律用 Web Mercator（正規化到 0..1）並以澳門為原點。縮放時只改 <g> 的
 *    transform，不必每次重新投影 119 個國家、147 個環；以澳門為原點也讓高倍率下的
 *    座標值維持在 1e-3 等級，不會因 float 精度不足而抖動。
 * 2. 樹點放在同一個 transform 群組裡，半徑以「世界單位」表示（= 螢幕 px ÷ 目前縮放），
 *    拖曳時完全不必動 658 個圓點，只有縮放時才更新一次半徑。
 * 3. 所有互動都用 addEventListener，沒有行內事件屬性（CSP script-src 'self' 會擋）。
 * 4. 地理資料向 /data/world-geo.json 抓一次即快取；模組載入時不碰 DOM，方便測試直接 import。
 */

const NS = 'http://www.w3.org/2000/svg';
const GEO_URL = '/data/world-geo.json';
const RAD = Math.PI / 180;
const MAX_LAT = 85.05112878;
const BASE = 256;          // z = 0 時整個世界寬 256px，與 Web Mercator 圖磚一致
const MIN_Z = 0.6;
const MAX_Z = 17.5;
const TREES_MIN_Z = 11;    // 進入澳門範圍才畫樹點，避免低倍率變成一團
const WORLD_MAX_Z = 8.4;   // 再放大就換成珠三角高解析海岸線；世界國界在 8 級以上過於粗糙
const PARISH_MIN_Z = 9.6;

/** 澳門中心（議事亭前地一帶），作為區域座標原點 */
const ORIGIN = merc(113.5540, 22.1630);

/** 經緯度 → 正規化 Web Mercator（x、y 皆 0..1，y 向下） */
function merc(lon, lat) {
  const phi = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * RAD;
  return {
    x: (lon + 180) / 360,
    y: 0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI),
  };
}

/** 經緯度 → 以澳門為原點的世界座標（單位：世界寬 = 1） */
function project(lon, lat) {
  const m = merc(lon, lat);
  return { x: m.x - ORIGIN.x, y: m.y - ORIGIN.y };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a / 2;
}

/** 最大環的面積中心（國家／堂區標籤用；跨換日線的國家標籤會略偏，可接受） */
function ringCentroid(ring) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    a += cross;
    cx += (ring[i][0] + ring[i + 1][0]) * cross;
    cy += (ring[i][1] + ring[i + 1][1]) * cross;
  }
  if (!a) return ring[0];
  a *= 0.5;
  return { x: cx / (6 * a), y: cy / (6 * a), area: Math.abs(a) };
}

function toPath(rings, decimals) {
  let d = '';
  for (const ring of rings) {
    if (ring.length < 3) continue;
    d += `M${ring[0][0].toFixed(decimals)} ${ring[0][1].toFixed(decimals)}`;
    for (let i = 1; i < ring.length; i += 1) {
      d += `L${ring[i][0].toFixed(decimals)} ${ring[i][1].toFixed(decimals)}`;
    }
    d += 'Z';
  }
  return d;
}

function boundsOf(groups) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const g of groups) {
    for (const ring of g) {
      for (const [x, y] of ring) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

/** 地理資料只抓一次；prepare 後的結果（世界座標）供所有地圖實例共用 */
let geoPromise = null;

function loadGeo() {
  if (!geoPromise) {
    geoPromise = fetch(GEO_URL, { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error(`地理資料回應 ${res.status}`);
        return res.json();
      })
      .then(prepareGeo)
      .catch((err) => {
        geoPromise = null;   // 允許之後重新嘗試（例如暫時離線）
        throw err;
      });
  }
  return geoPromise;
}

function prepareGeo(raw) {
  const toLocal = (ring) => ring.map(([lon, lat]) => {
    const p = project(lon, lat);
    return [p.x, p.y];
  });

  const countries = (raw.world || []).map((c) => {
    const rings = (c.r || []).map(toLocal).filter((r) => r.length >= 3);
    let main = null;
    let best = -1;
    for (const r of rings) {
      const a = Math.abs(ringArea(r));
      if (a > best) { best = a; main = r; }
    }
    const center = main ? ringCentroid(main) : { x: 0, y: 0, area: 0 };
    return { n: c.n, rings, center, area: center.area || 0 };
  }).filter((c) => c.rings.length);

  const parishes = (raw.parishes || []).map((p) => {
    const rings = [...(p.o || []), ...(p.i || [])].map(toLocal).filter((r) => r.length >= 3);
    let main = null;
    let best = -1;
    for (const r of rings) {
      const a = Math.abs(ringArea(r));
      if (a > best) { best = a; main = r; }
    }
    const center = main ? ringCentroid(main) : { x: 0, y: 0 };
    return { n: p.n, rings, center, area: center.area || 0 };
  }).filter((p) => p.rings.length);

  const prd = (raw.prd || []).map(toLocal).filter((r) => r.length >= 3);

  return {
    countries,
    parishes,
    prd,
    worldBox: boundsOf(countries.map((c) => c.rings)),
    macauBox: boundsOf(parishes.map((p) => p.rings)),
  };
}

function levelName(z) {
  if (z < 3.2) return '世界';
  if (z < 6) return '洲際';
  if (z < 8.5) return '東亞';
  if (z < 10.6) return '珠江三角洲';
  if (z < 12.4) return '澳門全境';
  if (z < 14.2) return '堂區';
  if (z < 15.8) return '街區';
  return '街道';
}

function healthClass(health) {
  if (health === '健康') return 'good';
  if (health === '瀕危') return 'bad';
  return 'fair';
}

/**
 * 建立世界地圖。
 *
 * @param {HTMLElement} container 掛載容器（需有高度）
 * @param {{ trees?: Array<object>, onSelect?: (treeNo: string) => void }} options
 * @returns {{ destroy: () => void, setTrees: (list: Array<object>) => void,
 *            focusTree: (no: string|number) => boolean, focusMacau: () => void,
 *            reset: () => void }}
 */
export function createWorldMap(container, options = {}) {
  if (!container || container.nodeType !== 1) {
    throw new Error('createWorldMap 需要一個有效的容器元素');
  }
  const onSelect = typeof options.onSelect === 'function' ? options.onSelect : null;
  let trees = Array.isArray(options.trees) ? options.trees.slice() : [];

  const controller = new AbortController();
  const signal = controller.signal;
  let dead = false;
  let geo = null;
  let W = 0;
  let H = 0;
  const view = { x: 0, y: 0, z: 12.8 };
  let treeEls = [];
  let treeByNo = new Map();
  const parishLabels = [];
  let focusedNo = null;
  let lastRadiusScale = 0;
  let radiusDirty = true;
  let paintQueued = false;
  let viewReady = false;

  // ── DOM 骨架 ─────────────────────────────────────────────
  container.classList.add('worldmap');
  container.replaceChildren();

  const svg = svgEl('svg', {
    class: 'wm-svg',
    role: 'img',
    'aria-label': '澳門古樹世界地圖，可從世界縮放至珠江三角洲、澳門各堂區與單棵古樹',
  });
  const space = svgEl('g', { class: 'wm-space' });
  const worldG = svgEl('g', { class: 'wm-world' });
  const prdG = svgEl('g', { class: 'wm-prd-layer' });
  const parishG = svgEl('g', { class: 'wm-parishes' });
  const labelG = svgEl('g', { class: 'wm-labels' });
  const treeG = svgEl('g', { class: 'wm-trees' });
  space.append(worldG, prdG, parishG, treeG, labelG);
  svg.appendChild(space);
  container.appendChild(svg);

  const status = document.createElement('p');
  status.className = 'wm-status';
  status.setAttribute('role', 'status');
  status.textContent = '載入世界地理資料…';
  container.appendChild(status);

  const controls = document.createElement('div');
  controls.className = 'wm-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', '地圖縮放與定位');
  const buttonSpecs = [
    { act: 'in', label: '＋', title: '放大' },
    { act: 'out', label: '−', title: '縮小' },
    { act: 'macau', label: '定位澳門', title: '縮放至澳門全境' },
    { act: 'world', label: '世界', title: '回到世界地圖' },
  ];
  for (const spec of buttonSpecs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wm-btn';
    btn.dataset.wm = spec.act;
    btn.textContent = spec.label;
    btn.title = spec.title;
    btn.setAttribute('aria-label', spec.title);
    controls.appendChild(btn);
  }
  container.appendChild(controls);

  // 圖例以 DOM API 建立（不用 innerHTML 拼字串），避免任何注入疑慮
  const legend = document.createElement('div');
  legend.className = 'wm-legend';
  const legendTitle = document.createElement('strong');
  legendTitle.textContent = '健康狀況';
  legend.appendChild(legendTitle);
  for (const [cls, text] of [['good', '健康'], ['fair', '一般'], ['bad', '瀕危']]) {
    const item = document.createElement('span');
    const dot = document.createElement('i');
    dot.className = `wm-dot ${cls}`;
    item.append(dot, document.createTextNode(text));
    legend.appendChild(item);
  }
  container.appendChild(legend);

  const hint = document.createElement('p');
  hint.className = 'wm-hint';
  hint.textContent = '滾輪縮放・拖曳平移・雙擊放大';
  container.appendChild(hint);

  // ── 視圖數學 ─────────────────────────────────────────────
  const scale = () => BASE * (2 ** view.z);

  function measure() {
    W = Math.max(1, Math.round(container.clientWidth || 0));
    H = Math.max(1, Math.round(container.clientHeight || 0));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }

  function clampView() {
    const box = geo ? geo.worldBox : { x0: -1.4, x1: 0.6, y0: -0.4, y1: 1.4 };
    const mx = (box.x1 - box.x0) * 0.12;
    const my = (box.y1 - box.y0) * 0.12;
    view.x = clamp(view.x, box.x0 - mx, box.x1 + mx);
    view.y = clamp(view.y, box.y0 - my, box.y1 + my);
  }

  function fitBox(box, pad = 26) {
    if (!box || !Number.isFinite(box.x0) || !Number.isFinite(box.x1)) return;
    measure();
    const w = Math.max(1e-9, box.x1 - box.x0);
    const h = Math.max(1e-9, box.y1 - box.y0);
    const s = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
    view.z = clamp(Math.log2(Math.max(1, s) / BASE), MIN_Z, MAX_Z);
    view.x = (box.x0 + box.x1) / 2;
    view.y = (box.y0 + box.y1) / 2;
    clampView();
    viewReady = true;
    radiusDirty = true;
    paint();
  }

  function zoomAround(factor, px, py) {
    const s = scale();
    const wx = view.x + (px - W / 2) / s;
    const wy = view.y + (py - H / 2) / s;
    const nz = clamp(view.z + Math.log2(factor), MIN_Z, MAX_Z);
    if (nz === view.z) return;
    view.z = nz;
    const s2 = scale();
    view.x = wx - (px - W / 2) / s2;
    view.y = wy - (py - H / 2) / s2;
    clampView();
    radiusDirty = true;
  }

  function zoomAt(factor, px = W / 2, py = H / 2) {
    zoomAround(factor, px, py);
    paint();
  }

  function panByPx(dx, dy) {
    const s = scale();
    view.x -= dx / s;
    view.y -= dy / s;
    clampView();
  }

  // ── 圖層建立 ─────────────────────────────────────────────
  function buildLayers() {
    worldG.replaceChildren();
    prdG.replaceChildren();
    parishG.replaceChildren();
    labelG.replaceChildren();
    parishLabels.length = 0;

    for (const c of geo.countries) {
      worldG.appendChild(svgEl('path', {
        d: toPath(c.rings, 6),
        class: 'wm-country',
        'fill-rule': 'evenodd',
      }));
    }

    if (geo.prd.length) {
      prdG.appendChild(svgEl('path', {
        d: toPath(geo.prd, 7),
        class: 'wm-prd',
        'fill-rule': 'evenodd',
      }));
    }

    for (const p of geo.parishes) {
      parishG.appendChild(svgEl('path', {
        d: toPath(p.rings, 9),
        class: 'wm-parish',
        'fill-rule': 'evenodd',
      }));
      const label = svgEl('text', {
        class: 'wm-parish-label',
        x: p.center.x.toFixed(9),
        y: p.center.y.toFixed(9),
        'text-anchor': 'middle',
      });
      label.textContent = p.n;
      labelG.appendChild(label);
      parishLabels.push({ el: label, area: p.area });
    }
  }

  function buildTreeEls() {
    treeG.replaceChildren();
    treeEls = [];
    treeByNo = new Map();
    const fragment = document.createDocumentFragment();
    const seen = new Set();

    for (const t of trees) {
      const no = String(t && t.tree_no != null ? t.tree_no : '');
      if (!no || seen.has(no)) continue;
      const lat = Number(t.lat);
      const lon = Number(t.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;   // 缺座標就跳過
      seen.add(no);
      const pos = project(lon, lat);
      const circle = svgEl('circle', {
        class: `wm-tree ${healthClass(t.health)}`,
        cx: '0',
        cy: '0',
        r: '4',
        'data-wm-tree': no,
      });
      const title = document.createElementNS(NS, 'title');
      const age = t.age_years != null && Number.isFinite(Number(t.age_years))
        ? `${Number(t.age_years)} 年` : '樹齡不詳';
      title.textContent = `#${no} ${t.species || '古樹'} · ${age}`;
      circle.appendChild(title);
      fragment.appendChild(circle);
      treeEls.push({ no, el: circle, x: pos.x, y: pos.y });
      treeByNo.set(no, { tree: t, x: pos.x, y: pos.y });
    }
    treeG.appendChild(fragment);
    if (focusedNo && !treeByNo.has(focusedNo)) focusedNo = null;
    radiusDirty = true;
    paint();
  }

  // ── 繪製 ────────────────────────────────────────────────
  function updateRadii() {
    const s = scale();
    if (!radiusDirty && s === lastRadiusScale) return;
    lastRadiusScale = s;
    radiusDirty = false;
    const basePx = view.z >= 14.5 ? 5.2 : view.z >= 12 ? 4.2 : 3.2;
    // 圓點半徑用「螢幕 px」表示，再用 scale(1/s) 抵銷外層 <g> 的放大。
    // 不能直接把 r 寫成 4/s：在高倍率下 r 會小到 1e-7，Chrome 會把幾何算成 0
    //（實測 z≈15.6 時所有圓點都消失），改成本地半徑固定、只縮 transform 才穩定。
    const inv = (1 / s).toFixed(12);
    for (const item of treeEls) {
      const px = item.no === focusedNo ? basePx + 2 : basePx;
      item.el.setAttribute('r', String(px));
      item.el.setAttribute('transform',
        `translate(${item.x.toFixed(9)} ${item.y.toFixed(9)}) scale(${inv})`);
    }
  }

  function updateLabels() {
    const s = scale();
    const near = view.z >= 12.4;
    // 澳門半島四個小堂區的標籤在初始倍率會互相重疊；先只標面積較大的堂區，
    // 放大到 z≥14.2（半島在畫面上夠寬）再全部顯示。
    for (const item of parishLabels) {
      const show = near && (view.z >= 14.2 || item.area > 2e-9);
      item.el.style.display = show ? '' : 'none';
      if (show) {
        item.el.setAttribute('font-size', (11 / s).toFixed(9));
        item.el.setAttribute('stroke-width', (3 / s).toFixed(9));
      }
    }
  }

  function updateStatus() {
    const level = levelName(view.z);
    status.textContent = view.z >= TREES_MIN_Z
      ? `${level} · 顯示 ${treeEls.length} 株古樹`
      : `${level} · 縮放或按「定位澳門」查看古樹`;
  }

  function paint() {
    if (dead || !geo) return;
    if (!W || !H) measure();
    const s = scale();
    space.setAttribute('transform',
      `translate(${W / 2} ${H / 2}) scale(${s}) translate(${-view.x} ${-view.y})`);

    worldG.style.display = view.z < WORLD_MAX_Z ? '' : 'none';
    prdG.style.display = view.z >= 5.4 && view.z <= 12.5 ? '' : 'none';
    parishG.style.display = view.z >= PARISH_MIN_Z ? '' : 'none';
    treeG.style.display = view.z >= TREES_MIN_Z ? '' : 'none';

    updateRadii();
    updateLabels();
    updateStatus();
  }

  function schedulePaint() {
    if (paintQueued || dead) return;
    paintQueued = true;
    requestAnimationFrame(() => {
      paintQueued = false;
      paint();
    });
  }

  // ── 互動 ────────────────────────────────────────────────
  const pointers = new Map();
  let dragging = false;
  let moved = 0;
  let pinchDist = 0;
  let lastMid = null;

  function localPos(e) {
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest && e.target.closest('.wm-controls')) return;
    const p = localPos(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      dragging = true;
      moved = 0;
      pinchDist = 0;
      lastMid = null;
    } else if (pointers.size === 2) {
      dragging = false;
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const p = localPos(e);
    pointers.set(e.pointerId, p);

    if (pointers.size === 1 && dragging) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      moved += Math.hypot(dx, dy);
      panByPx(dx, dy);
      schedulePaint();
      return;
    }

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinchDist > 0 && dist > 0) zoomAround(dist / pinchDist, mid.x, mid.y);
      if (lastMid) panByPx(mid.x - lastMid.x, mid.y - lastMid.y);
      pinchDist = dist;
      lastMid = mid;
      schedulePaint();
    }
  }

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 1) {
      dragging = true;       // 雙指放掉一指後，剩下那指可以繼續拖曳
      pinchDist = 0;
      lastMid = null;
      moved = 10;            // 不把收指動作當成點擊
    } else if (pointers.size === 0) {
      dragging = false;
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const p = localPos(e);
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const k = e.ctrlKey ? 0.0075 : 0.0015;   // 觸控板 pinch 會帶 ctrlKey
    zoomAt(Math.exp(-e.deltaY * unit * k), p.x, p.y);
  }

  function onClick(e) {
    if (moved > 6) return;                  // 拖曳結束後的 click 不當成選樹
    const node = e.target.closest ? e.target.closest('[data-wm-tree]') : null;
    if (!node) return;
    const no = node.getAttribute('data-wm-tree');
    if (!no || !treeByNo.has(no)) return;
    focusedNo = no;
    radiusDirty = true;
    // 把選取的點移到最上層，避免被鄰近的點蓋住
    treeG.appendChild(node);
    paint();
    if (onSelect) onSelect(no);
  }

  function onDblClick(e) {
    if (e.target.closest && e.target.closest('[data-wm-tree]')) return;
    const p = localPos(e);
    zoomAt(1.7, p.x, p.y);
  }

  function onControlClick(e) {
    const btn = e.target.closest ? e.target.closest('button[data-wm]') : null;
    if (!btn) return;
    const act = btn.dataset.wm;
    if (act === 'in') zoomAt(1.5);
    else if (act === 'out') zoomAt(1 / 1.5);
    else if (act === 'macau') focusMacau();
    else if (act === 'world') reset();
  }

  function onKeyDown(e) {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(1.5); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(1 / 1.5); }
    else if (e.key === '0') { e.preventDefault(); focusMacau(); }
  }

  function cancelPointers() {
    pointers.clear();
    dragging = false;
    pinchDist = 0;
    lastMid = null;
    moved = 10;
  }

  svg.addEventListener('pointerdown', onPointerDown, { signal });
  //  move／up 掛在 window：拖曳到地圖外仍能追蹤，且不用 setPointerCapture
  // （pointer capture 會把 click 的 target 改成 svg，樹點就點不到）
  window.addEventListener('pointermove', onPointerMove, { signal });
  window.addEventListener('pointerup', endPointer, { signal });
  window.addEventListener('pointercancel', endPointer, { signal });
  window.addEventListener('blur', cancelPointers, { signal });
  svg.addEventListener('wheel', onWheel, { passive: false, signal });
  svg.addEventListener('click', onClick, { signal });
  svg.addEventListener('dblclick', onDblClick, { signal });
  controls.addEventListener('click', onControlClick, { signal });
  container.addEventListener('keydown', onKeyDown, { signal });

  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => {
      if (dead) return;
      measure();
      if (!geo) return;
      if (!viewReady) focusMacau();
      else paint();
    })
    : null;
  if (ro) ro.observe(container);

  // ── 對外 API ────────────────────────────────────────────
  function focusMacau() {
    if (!geo) return;
    fitBox(geo.macauBox, 34);
  }

  function reset() {
    if (!geo) return;
    fitBox(geo.worldBox, 22);
  }

  function focusTree(no) {
    const key = String(no);
    const hit = treeByNo.get(key);
    if (!hit) return false;
    focusedNo = key;
    view.x = hit.x;
    view.y = hit.y;
    view.z = Math.max(view.z, 15.6);
    clampView();
    radiusDirty = true;
    const node = treeEls.find((x) => x.no === key);
    if (node) treeG.appendChild(node.el);
    paint();
    return true;
  }

  function setTrees(list) {
    trees = Array.isArray(list) ? list.slice() : [];
    if (geo) buildTreeEls();
  }

  function destroy() {
    if (dead) return;
    dead = true;
    controller.abort();
    if (ro) ro.disconnect();
    container.replaceChildren();
    container.classList.remove('worldmap');
    treeEls = [];
    treeByNo = new Map();
  }

  measure();
  paint();   // 先畫空圖層，至少讓容器有正確尺寸

  loadGeo()
    .then((data) => {
      if (dead) return;
      geo = data;
      buildLayers();
      buildTreeEls();
      focusMacau();
      if (!geo.countries.length) status.textContent = '地理資料為空';
    })
    .catch((err) => {
      if (dead) return;
      status.textContent = '地理資料載入失敗，請重新整理頁面（平面地圖仍可使用）。';
      console.warn('世界地圖地理資料載入失敗', err);
    });

  return { destroy, setTrees, focusTree, focusMacau, reset };
}
