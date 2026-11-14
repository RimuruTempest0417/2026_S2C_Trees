/**
 * 專題導覽：把六章敘事整合成第 13 個分頁（#/story）。
 *
 * 設計原則：
 * 1. 圖表全部用原生 SVG 自繪，不引入任何套件或 CDN（CSP script-src 'self'）。
 * 2. 所有統計數字都在執行時由 /api/trees 的逐筆資料算出，原始碼不寫死任何統計值；
 *    只有「官方出處」這類引用文字是固定的。
 * 3. 後端失敗時顯示 errText()，不倒出空圖。
 * 4. 點長條／圓環／直方圖柱一律是 SVG 內的 <a href="#/…">，不靠行內事件屬性。
 */
import { api, cached } from './api.js';
import { esc, num, pct, errText, loading } from './ui.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 八個堂區／多類別用的色票；顏色本身定義在 style.css，這裡只給類別名。 */
const TONES = ['story-s0', 'story-s1', 'story-s2', 'story-s3', 'story-s4', 'story-s5', 'story-s6', 'story-s7'];
const HEALTH_TONES = { 健康: 'story-health-good', 一般: 'story-health-fair', 瀕危: 'story-health-bad' };
const GRADE_TONES = { 一級: 'story-grade-1', 二級: 'story-grade-2', 三級: 'story-grade-3', 不分級: 'story-grade-0' };

/* ── 純計算 ─────────────────────────────────────────────────── */

/** 依某個欄位分組計數，回傳由多到少排序的 [{ label, value }]。 */
export function groupCount(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const label = row[key];
    if (!label) continue;
    map.set(label, (map.get(label) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'zh-Hant'));
}

/**
 * 固定組距直方圖。最後一組包含最大值（例如 500–524 含 515），
 * 回傳的 end 是「含」的上界，方便直接組出 #/map?min_age=&max_age= 的連結。
 */
export function histogram(values, size) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length || !(size > 0)) return [];
  const min = Math.floor(Math.min(...nums) / size) * size;
  const max = Math.max(...nums);
  const bins = [];
  for (let start = min; start <= max; start += size) {
    const end = start + size - 1;
    bins.push({
      start,
      end,
      count: nums.filter((v) => v >= start && v <= end).length,
    });
  }
  return bins;
}

/** 皮爾森相關係數；樣本不足或變異為 0 時回傳 null。 */
export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (!sxx || !syy) return null;
  return sxy / Math.sqrt(sxx * syy);
}

const median = (values) => {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

/* ── SVG 圖表 ──────────────────────────────────────────────── */

function svgWrap(width, height, label, inner) {
  return `<div class="story-chart"><svg class="story-svg" viewBox="0 0 ${width} ${height}" xmlns="${SVG_NS}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${inner}</svg></div>`;
}

const link = (href) => `#${href}`;

/**
 * 橫向長條圖。items: [{ label, value, href, display? }]
 * display 只影響右側文字，value 才是長度（完整度圖用「有值數 / 總數」的寫法）。
 */
function barSvg(items, { ariaLabel, unit = '棵' } = {}) {
  const width = 640;
  const rowH = 30;
  const top = 6;
  const left = 104;
  const right = 58;
  const plot = width - left - right;
  const height = top + items.length * rowH + 4;
  const max = Math.max(1, ...items.map((i) => i.value));
  const rows = items.map((item, index) => {
    const y = top + index * rowH;
    const w = item.value > 0 ? Math.max(3, Math.round((item.value / max) * plot)) : 0;
    return `<a href="${esc(link(item.href))}" class="story-bar-link">
      <title>${esc(item.label)}：${num(item.value)} ${unit}</title>
      <text x="0" y="${y + 13}" class="story-label">${esc(item.label)}</text>
      <rect x="${left}" y="${y + 2}" width="${plot}" height="14" rx="4" class="story-bar-track"/>
      <rect x="${left}" y="${y + 2}" width="${w}" height="14" rx="4" class="story-bar${item.tone ? ` story-bar-tone ${item.tone}` : ''}"/>
      <text x="${left + w + 7}" y="${y + 13}" class="story-value">${esc(item.display || num(item.value))}</text>
    </a>`;
  }).join('');
  return svgWrap(width, height, ariaLabel, rows);
}

/** 圓環圖。items: [{ label, value, href, tone? }] */
function donutSvg(items, { ariaLabel, centerValue, centerLabel } = {}) {
  const width = 640;
  const height = 300;
  const cx = 126;
  const cy = 150;
  const r = 80;
  const sw = 30;
  const circumference = 2 * Math.PI * r;
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  let offset = 0;
  const segments = items.map((item, index) => {
    const len = (item.value / total) * circumference;
    const dash = `${len.toFixed(2)} ${(circumference - len).toFixed(2)}`;
    const tone = item.tone || TONES[index % TONES.length];
    const seg = `<a href="${esc(link(item.href))}" class="story-donut-link">
      <title>${esc(item.label)}：${num(item.value)} 棵（${pct((item.value / total) * 100)}）</title>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="${sw}"
        class="story-donut-seg ${tone}" stroke-dasharray="${dash}"
        stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>
    </a>`;
    offset += len;
    return seg;
  }).join('');

  const legend = items.map((item, index) => {
    const y = 26 + index * 30;
    const tone = item.tone || TONES[index % TONES.length];
    return `<a href="${esc(link(item.href))}" class="story-legend-link">
      <title>${esc(item.label)}：${num(item.value)} 棵</title>
      <rect x="270" y="${y - 10}" width="12" height="12" rx="3" class="story-fill ${tone}"/>
      <text x="289" y="${y}" class="story-label">${esc(item.label)}</text>
      <text x="530" y="${y}" class="story-muted" text-anchor="end">${num(item.value)}</text>
      <text x="628" y="${y}" class="story-value" text-anchor="end">${pct((item.value / total) * 100)}</text>
    </a>`;
  }).join('');

  const center = `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="story-donut-value">${esc(centerValue || '')}</text>
    <text x="${cx}" y="${cy + 20}" text-anchor="middle" class="story-axis">${esc(centerLabel || '')}</text>`;

  return svgWrap(width, height, ariaLabel, segments + center + legend);
}

/**
 * 100% 堆疊長條（單列或少列）。rows: [{ label, total, parts: [{ label, value, href, tone }] }]
 * 每一段都是獨立連結，可帶到「該堂區＋該健康狀況」的篩選結果。
 */
function stackedSvg(rows, { ariaLabel } = {}) {
  const width = 640;
  const left = 104;
  const right = 58;
  const rowH = 34;
  const top = 8;
  const plot = width - left - right;
  const height = top + rows.length * rowH + 6;
  const out = rows.map((row, rowIndex) => {
    const y = top + rowIndex * rowH;
    let x = left;
    const parts = row.parts.map((part, index) => {
      const w = row.total ? (part.value / row.total) * plot : 0;
      const tone = part.tone || TONES[index % TONES.length];
      const rect = part.value > 0 ? `<a href="${esc(link(part.href))}" class="story-seg-link">
        <title>${esc(row.label)}・${esc(part.label)}：${num(part.value)} 棵（${pct((part.value / row.total) * 100)}）</title>
        <rect x="${x.toFixed(2)}" y="${y + 3}" width="${w.toFixed(2)}" height="18" class="story-fill ${tone}"/>
      </a>` : '';
      x += w;
      return rect;
    }).join('');
    return `<text x="0" y="${y + 17}" class="story-label">${esc(row.label)}</text>
      ${parts}
      <text x="${left + plot + 7}" y="${y + 17}" class="story-value">${num(row.total)}</text>`;
  }).join('');
  return svgWrap(width, height, ariaLabel, out);
}

/** 直方圖。bins: [{ start, end, count }]；hrefFor(bin) 決定每根柱子連到哪裡。 */
function histogramSvg(bins, { ariaLabel, xTitle, hrefFor } = {}) {
  const width = 640;
  const height = 254;
  const left = 48;
  const right = 12;
  const top = 16;
  const bottom = 42;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const slot = plotW / bins.length;
  const gap = Math.min(4, slot * 0.18);
  const barW = Math.max(1, slot - gap);
  const step = Math.max(1, Math.ceil(bins.length / 8));

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = top + plotH - plotH * f;
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="story-grid"/>
      <text x="${left - 6}" y="${y + 4}" text-anchor="end" class="story-axis">${num(Math.round(max * f))}</text>`;
  }).join('');

  const bars = bins.map((bin, index) => {
    const h = bin.count > 0 ? Math.max(1, (bin.count / max) * plotH) : 0;
    const x = left + index * slot + gap / 2;
    const y = top + plotH - h;
    const rect = `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="2" class="story-bar"/>`;
    const bar = bin.count > 0 ? `<a href="${esc(link(hrefFor(bin)))}" class="story-bar-link">
      <title>${esc(bin.start)}–${esc(bin.end)}：${num(bin.count)} 棵</title>${rect}
    </a>` : rect;
    const tick = index % step === 0 || index === bins.length - 1
      ? `<text x="${(x + barW / 2).toFixed(2)}" y="${height - bottom + 17}" text-anchor="middle" class="story-axis">${num(bin.start)}</text>`
      : '';
    return bar + tick;
  }).join('');

  return svgWrap(width, height, ariaLabel, `${grid}
    <line x1="${left}" y1="${top + plotH}" x2="${width - right}" y2="${top + plotH}" class="story-axis-line"/>
    ${bars}
    <text x="${left + plotW / 2}" y="${height - 6}" text-anchor="middle" class="story-axis">${esc(xTitle || '')}</text>`);
}

/* ── 章節內容 ──────────────────────────────────────────────── */

function chapter(no, kicker, title, lead, body, more) {
  return `<section class="card story-chapter" id="story-s${no}">
    <header class="story-head">
      <span class="story-kicker">${esc(kicker)}</span>
      <h2>${title}</h2>
    </header>
    <p class="story-lead">${lead}</p>
    ${body}
    <p class="story-more"><strong>進一步查看：</strong>${more}</p>
  </section>`;
}

function facts(items) {
  return `<div class="story-facts">${items.map((it) => `<div class="story-fact">
    <span class="story-fact-value">${it.value}</span>
    <span class="story-fact-label">${it.label}</span>
  </div>`).join('')}</div>`;
}

function build(data) {
  const { trees, total } = data;
  const ages = trees.map((t) => t.age_years).filter(Number.isFinite);
  const heights = trees.map((t) => t.height_m).filter(Number.isFinite);

  // ── 一、堂區分佈 ──────────────────────────────────────────
  const parishes = groupCount(trees, 'parish');
  const parishTotal = parishes.reduce((a, b) => a + b.value, 0) || 1;
  const top = parishes[0] || { label: '—', value: 0 };
  const second = parishes[1] || { label: '—', value: 0 };
  const bottom = parishes[parishes.length - 1] || { label: '—', value: 0 };
  const parishRatio = bottom.value ? top.value / bottom.value : null;
  const topTwoShare = ((top.value + second.value) / parishTotal) * 100;

  const parishBars = barSvg(parishes.map((p) => ({
    label: p.label,
    value: p.value,
    href: `/map?parish=${encodeURIComponent(p.label)}`,
  })), { ariaLabel: `八個堂區的古樹株數，最多為${top.label}${num(top.value)}棵` });

  const parishDonut = donutSvg(parishes.map((p) => ({
    label: p.label,
    value: p.value,
    href: `/map?parish=${encodeURIComponent(p.label)}`,
  })), {
    ariaLabel: '各堂區古樹佔全澳比例',
    centerValue: num(total),
    centerLabel: '全澳株數',
  });

  const ch1 = chapter(1, '01 · 分佈', '各堂區古樹數目分佈',
    '古樹的分佈跟著土地歷史走，而不是跟著人口走：長期作為廟宇、園林或墳場而沒有大規模動土的地方，才留得下高齡個體。',
    `<div class="grid grid-2">
      <div><h3>各堂區株數</h3>${parishBars}</div>
      <div><h3>堂區佔比</h3>${parishDonut}</div>
    </div>
    <div class="summary"><strong>讀出來</strong>
      ${esc(top.label)}以 ${num(top.value)} 棵居首（${pct((top.value / parishTotal) * 100)}），
      ${esc(bottom.label)}只有 ${num(bottom.value)} 棵，兩者相差 ${num(parishRatio, 1)} 倍；
      前兩個堂區合計已佔 ${pct(topTwoShare)}。這個落差反映的是開發時序與綠地保留，不是各區對古樹的照顧程度。
    </div>`,
    `<a href="#/map?parish=${encodeURIComponent(top.label)}">在地圖上看${esc(top.label)}的 ${num(top.value)} 棵</a>
     · <a href="#/map">全部 ${num(total)} 棵</a>
     · <a href="#/analytics">堂區之間的統計檢定</a>`);

  // ── 二、樹種結構 ──────────────────────────────────────────
  const species = groupCount(trees, 'species');
  const speciesTotal = species.reduce((a, b) => a + b.value, 0) || 1;
  const topSpecies = species[0] || { label: '—', value: 0 };
  const restSpecies = speciesTotal - topSpecies.value;
  const topThree = species.slice(0, 3).reduce((a, b) => a + b.value, 0);

  const speciesBars = barSvg(species.slice(0, 10).map((s) => ({
    label: s.label,
    value: s.value,
    href: `/map?species=${encodeURIComponent(s.label)}`,
  })), { ariaLabel: `株數最多的十個樹種，第一位是${topSpecies.label}` });

  const speciesShare = stackedSvg([{
    label: '全部樹種',
    total: speciesTotal,
    parts: [
      { label: topSpecies.label, value: topSpecies.value, href: `/map?species=${encodeURIComponent(topSpecies.label)}`, tone: TONES[1] },
      { label: `其餘 ${num(species.length - 1)} 種`, value: restSpecies, href: '/analytics', tone: TONES[7] },
    ],
  }], { ariaLabel: `${topSpecies.label}與其餘樹種的株數比例` });

  const ch2 = chapter(2, '02 · 樹種', '樹種結構',
    `全澳古樹只屬於 ${num(species.length)} 個樹種，而其中一種就佔了超過一半——這種「雞蛋放在同一個籃子」的組成，是保育上的結構性風險。`,
    `<div class="story-share">
      <h3>一種與其餘的差距</h3>
      ${speciesShare}
      <p class="small muted">滑過或點按色段可分別查看該樹種與整體分析。</p>
    </div>
    <div class="story-share">
      <h3>株數前十的樹種</h3>
      ${speciesBars}
    </div>
    <div class="summary"><strong>讀出來</strong>
      ${esc(topSpecies.label)}有 ${num(topSpecies.value)} 棵（${pct((topSpecies.value / speciesTotal) * 100)}），
      比其餘 ${num(species.length - 1)} 種合計 ${num(restSpecies)} 棵還多；前 ${num(species.slice(0, 3).length)} 種合計
      ${pct((topThree / speciesTotal) * 100)}。一旦出現專一性病蟲害（例如榕樹枯萎病），損失會以百棵計；
      城市綠化宜逐步提高鄉土樹種的多樣性。
    </div>`,
    `<a href="#/map?species=${encodeURIComponent(topSpecies.label)}">在地圖上看${esc(topSpecies.label)}</a>
     · <a href="#/analytics">品種對樹高的變異數分析</a>
     · <a href="#/knowledge">樹種與病蟲害科普</a>`);

  // ── 三、樹齡與樹高 ────────────────────────────────────────
  const ageBins = histogram(ages, 25);
  const heightBins = histogram(heights, 5);
  const over100 = ages.filter((a) => a >= 100).length;
  const oldest = trees.reduce((a, b) => ((b.age_years || 0) > (a.age_years || 0) ? b : a), trees[0] || {});
  const heightMode = heightBins.reduce((a, b) => (b.count > a.count ? b : a), heightBins[0] || { start: 0, end: 0, count: 0 });
  const ageHeightR = pearson(ages, heights);
  const ageMedian = median(ages);

  const ageChart = histogramSvg(ageBins, {
    ariaLabel: '古樹樹齡分佈直方圖',
    xTitle: '樹齡（年，每 25 年一組）',
    hrefFor: (bin) => `/map?min_age=${bin.start}&max_age=${bin.end}`,
  });
  const heightChart = histogramSvg(heightBins, {
    ariaLabel: '古樹樹高分佈直方圖',
    xTitle: '樹高（公尺，每 5 公尺一組）',
    hrefFor: () => '/analytics',
  });

  const ch3 = chapter(3, '03 · 年齡與身形', '樹齡結構與樹高結構',
    '絕大多數個體都跨過了百年門檻，樹高卻沒有跟著樹齡一路上升——決定身形的主要是樹種，而不是年紀。',
    facts([
      { value: pct((over100 / total) * 100), label: `樹齡達 100 年或以上（${num(over100)} 棵）` },
      { value: num(ageMedian), label: '樹齡中位數（年）' },
      { value: `#${esc(oldest.tree_no || '—')}`, label: `最老：${esc(oldest.species || '—')} ${num(oldest.age_years)} 年` },
      { value: Number.isFinite(ageHeightR) ? num(ageHeightR, 3) : '—', label: '樹齡與樹高相關係數 r' },
    ]) + `<div class="grid grid-2">
      <div><h3>樹齡分佈</h3>${ageChart}</div>
      <div><h3>樹高分佈</h3>${heightChart}</div>
    </div>
    <div class="summary"><strong>讀出來</strong>
      ${num(over100)} 棵（${pct((over100 / total) * 100)}）樹齡達 100 年或以上，最老的是
      ${esc(oldest.site || '—')}的${esc(oldest.species || '—')}（#${esc(oldest.tree_no || '—')}），官方推估
      ${num(oldest.age_years)} 年。樹高最集中的區間是 ${num(heightMode.start)}–${num(heightMode.end)} 公尺
      （${num(heightMode.count)} 棵）；樹齡與樹高的相關係數只有 ${Number.isFinite(ageHeightR) ? num(ageHeightR, 3) : '—'}，
      同一樹齡可以長出完全不同的高度。
    </div>`,
    `<a href="#/map?min_age=100">只看 100 年以上的古樹</a>
     · <a href="#/analytics">樹齡—樹高散點圖與擬合模型</a>
     · <a href="#/priority">高齡個體的優先巡查建議</a>`);

  // ── 四、健康與保護級別 ────────────────────────────────────
  const health = ['健康', '一般', '瀕危'].map((name) => ({
    label: name,
    value: trees.filter((t) => t.health === name).length,
    href: `/map?health=${encodeURIComponent(name)}`,
    tone: HEALTH_TONES[name],
  }));
  const endangered = health.find((h) => h.label === '瀕危') || { value: 0 };
  const grades = ['一級', '二級', '三級', '不分級'].map((name) => ({
    label: name,
    value: trees.filter((t) => t.grade === name).length,
    href: `/map?grade=${encodeURIComponent(name)}`,
    tone: GRADE_TONES[name],
  }));

  const healthDonut = donutSvg(health, {
    ariaLabel: '全澳古樹健康狀況比例',
    centerValue: pct((endangered.value / total) * 100),
    centerLabel: '列為瀕危',
  });

  const parishRows = parishes.map((p) => {
    const list = trees.filter((t) => t.parish === p.label);
    return {
      label: p.label,
      total: list.length,
      parts: health.map((h) => ({
        label: h.label,
        value: list.filter((t) => t.health === h.label).length,
        href: `/map?parish=${encodeURIComponent(p.label)}&health=${encodeURIComponent(h.label)}`,
        tone: h.tone,
      })),
    };
  });

  const significant = parishRows.filter((r) => r.total >= 20);
  const healthShare = significant.map((r) => {
    const good = r.parts.find((p) => p.label === '健康');
    return { label: r.label, share: r.total ? (good.value / r.total) * 100 : 0, total: r.total };
  }).sort((a, b) => a.share - b.share);
  const lowest = healthShare[0] || { label: '—', share: 0 };
  const highest = healthShare[healthShare.length - 1] || { label: '—', share: 0 };
  const healthGap = lowest.share ? highest.share / lowest.share : null;

  const healthStack = stackedSvg(parishRows, { ariaLabel: '各堂區健康狀況組成（100% 堆疊）' });
  const gradeBars = barSvg(grades.map((g) => ({
    label: g.label,
    value: g.value,
    href: g.href,
    tone: g.tone,
  })), { ariaLabel: '各保護級別的株數' });

  const ch4 = chapter(4, '04 · 健康與保護', '健康狀況與保護級別',
    '健康比例在同一座城市裡可以差上數倍：樓宇、道路與人流密集的地方，古樹承受的壓力也最集中。',
    `<div class="grid grid-2">
      <div><h3>整體健康狀況</h3>${healthDonut}</div>
      <div><h3>各保護級別株數</h3>${gradeBars}
        <p class="tiny muted">級別依第 279/2025 號行政長官批示《古樹名木保護名錄》，不由本平台判定。</p>
      </div>
    </div>
    <h3>各堂區健康組成</h3>
    ${healthStack}
    <p class="tiny muted">每一段可點按，直接跳到「該堂區＋該健康狀況」的地圖清單；橫條長度為 100%，右側數字為該區總株數。</p>
    <div class="summary"><strong>讀出來</strong>
      全澳有 ${num(endangered.value)} 棵列為瀕危（${pct((endangered.value / total) * 100)}）。
      以株數達 20 棵的堂區比較，健康比例最低的是${esc(lowest.label)}（${pct(lowest.share)}），
      最高的是${esc(highest.label)}（${pct(highest.share)}），相差 ${num(healthGap, 1)} 倍。
      這是空間上的關聯，不能直接當成「城市化導致不健康」的因果證明；但它足以說明巡查資源為何應優先放在舊城區。
    </div>`,
    `<a href="#/map?health=${encodeURIComponent(health[2].label)}">只看${esc(health[2].label)}的 ${num(endangered.value)} 棵</a>
     · <a href="#/priority">優先保育名單與理由</a>
     · <a href="#/analytics">堂區 × 健康的卡方檢定</a>`);

  // ── 五、古樹圖鑑入口 ──────────────────────────────────────
  const withCrown = trees.filter((t) => Number.isFinite(t.crown_m)).length;
  const withPhoto = trees.filter((t) => t.tree_photo).length;
  const coverage = [
    { label: '座標', value: trees.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon)).length, href: '/map' },
    { label: '樹齡', value: ages.length, href: '/analytics' },
    { label: '樹高', value: heights.length, href: '/analytics' },
    { label: '胸徑', value: trees.filter((t) => Number.isFinite(t.diameter_cm)).length, href: '/analytics' },
    { label: '官方照片', value: withPhoto, href: '/map' },
    { label: '冠幅', value: withCrown, href: '/map' },
  ].map((c) => ({ ...c, display: `${num(c.value)} / ${num(total)}` }));

  const entryCards = [
    { href: '/map', title: '地圖查詢', text: `${num(total)} 個定位點，可依堂區、樹種、健康、級別與年齡逐步篩選，再點開單株詳情。` },
    { href: '/analytics', title: '數據分析', text: '樹齡、樹高、品種與健康的描述統計、擬合模型與檢定。' },
    { href: '/priority', title: '優先保育', text: '把樹齡、健康與稀有度合成風險排序，輸出可執行的巡查名單。' },
    { href: '/knowledge', title: '保育科普', text: '樹種辨識、病蟲害、保護法規與日常觀察的入門文章。' },
  ];

  const ch5 = chapter(5, '05 · 圖鑑入口', `古樹圖鑑：${num(total)} 棵逐筆資料`,
    `逐株資料不在這裡重做一份卡片牆——地圖與清單已經是同一批 ${num(total)} 筆資料的最佳介面，這一章只負責把你送到正確的入口。`,
    `<div class="story-entries">${entryCards.map((c) => `<a class="story-entry" href="#${c.href}">
      <span class="story-entry-title">${esc(c.title)}</span>
      <span class="story-entry-text">${esc(c.text)}</span>
      <span class="story-entry-go">前往 →</span>
    </a>`).join('')}</div>
    <h3>逐筆欄位的完整度</h3>
    ${barSvg(coverage, { ariaLabel: '逐筆欄位有值的株數' })}
    <p class="small muted">座標、樹齡、樹高與胸徑幾乎涵蓋全部個體；冠幅只有 ${num(withCrown)} 棵有官方數值，
      因此地圖與清單不把冠幅當成主要篩選條件。缺漏就是缺漏，本頁不以推估值補齊。</p>
    <p><button class="btn btn-sm" type="button" data-story-random="1">隨機看一棵古樹</button>
      <span class="small muted">（會開啟該棵樹在地圖上的詳情）</span></p>
    <div class="summary"><strong>讀出來</strong>
      這一批資料的強項是「每一棵都找得到」：${num(trees.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon)).length)}
      棵有座標、${num(withPhoto)} 棵有官方照片。弱項是冠幅與部分形態描述，遇到空白欄位時應回到市政署原頁核對，而不是用內插或平均填補。
    </div>`,
    `<a href="#/map">地圖查詢（逐株定位）</a>
     · <a href="#/analytics">數據分析</a>
     · <a href="#/priority">優先保育</a>
     · <a href="#/knowledge">保育科普</a>`);

  // ── 六、資料來源 ──────────────────────────────────────────
  const meta = data.meta || null;
  const fetchedAt = meta && meta.site && meta.site.data ? meta.site.data.fetched_at : '';
  const sourceCount = meta && meta.site && meta.site.counts ? meta.site.counts.trees : total;

  const ch6 = chapter(6, '06 · 出處', '資料來源',
    '這一頁的每一個數字都能沿著同一條路回查：官方逐筆資料 → 本站 API → 瀏覽器即時計算，中間沒有人工調整的統計值。',
    `<div class="sources">
      <ul>
        <li><strong>澳門市政署「澳門自然網」— 古樹名木</strong>：逐株座標、樹齡、樹高、胸徑／胸圍、冠幅、健康狀況、保護級別、形態描述與照片。
          <a href="https://www.iam.gov.mo/nature/c/tree" target="_blank" rel="noopener">官方頁面</a>；
          原始資料端點 <a href="https://www.iam.gov.mo/nature/BigJson/oldtrees_c.json" target="_blank" rel="noopener">oldtrees_c.json</a>。
          本章計算所用的資料集共 ${num(sourceCount)} 筆${fetchedAt ? `，抓取時間 ${esc(fetchedAt)}` : ''}。</li>
        <li><strong>第 279/2025 號行政長官批示《古樹名木保護名錄》</strong>：載《澳門特別行政區公報》第一組第 1 期，2026 年 1 月 5 日；保護級別以此為準。</li>
        <li><strong>第 11/2013 號法律《文化遺產保護法》第 106 條</strong>（古樹名木）：
          <a href="https://bo.dsaj.gov.mo/bo/i/2013/36/lei11_cn.asp" target="_blank" rel="noopener">法規全文</a>。</li>
        <li><strong>地圖底圖</strong>：© OpenStreetMap 貢獻者（ODbL）；世界國界 Natural Earth（公有領域）。</li>
      </ul>
    </div>
    <div class="notice notice-info story-notice">
      <strong>官方數值不換算：</strong>樹齡、樹高、胸徑與胸圍、健康狀況、保護級別一律沿用官方欄位原值，
      本頁不做單位換算、不內插、不平均，也不自行分級。只有「有幾棵」「佔多少」這類計數與比例是由本站計算。
    </div>
    <p class="small story-note-gap">
      本章圖表在頁面開啟時，以 <code>/api/trees</code> 回傳的 ${num(total)} 筆逐筆資料即時計算；
      原始碼沒有寫死任何統計值。官方資料日後若有更新，圖表會跟著變動，數字以當次載入的資料為準。
    </p>
    <div class="summary"><strong>讀出來</strong>
      資料的權威性來自市政署，本頁的價值在於把同一批數字重新排列成可以比較的形狀。
      引用時請同時標明官方出處與抓取日期，並保留「官方原值、本站僅加總」這條界線。
    </div>`,
    `<a href="https://www.iam.gov.mo/nature/c/tree" target="_blank" rel="noopener">市政署古樹名木原始頁面</a>
     · <a href="#/knowledge">保護法規與樹種科普</a>
     · <a href="#/analytics">本站統計方法</a>`);

  return ch1 + ch2 + ch3 + ch4 + ch5 + ch6;
}

/* ── 進入點 ────────────────────────────────────────────────── */

export async function render(section, params) {
  section.innerHTML = `<div class="page-head">
      <h1>專題導覽</h1>
      <p>把整份古樹名錄讀成六個問題：它們長在哪裡、是什麼樹、幾歲、健不健康，以及可以從哪裡繼續看下去。
        所有圖表都在開啟頁面時由本站資料即時計算，不使用預先寫好的統計值。</p>
      <div class="story-toc" aria-label="章節快速跳轉">
        ${[['1', '分佈'], ['2', '樹種'], ['3', '年齡'], ['4', '健康'], ['5', '圖鑑'], ['6', '來源']]
    .map(([n, label]) => `<button class="chip" type="button" data-story-go="story-s${n}">${n} ${label}</button>`).join('')}
      </div>
    </div>
    <div id="story-body">${loading('正在從逐筆資料計算六章圖表…')}</div>`;

  const body = section.querySelector('#story-body');
  let trees;
  let meta = null;
  try {
    const [res, metaRes] = await Promise.all([
      cached('story:trees', () => api.trees({ limit: 2000 })),
      cached('meta', () => api.meta()).catch(() => null),
    ]);
    trees = res && Array.isArray(res.trees) ? res.trees : [];
    meta = metaRes;
    if (!trees.length) throw new Error('API 回傳的樹木清單是空的');
  } catch (err) {
    body.innerHTML = `<div class="card">
      <h2>無法載入專題資料</h2>
      <p class="muted">${esc(errText(err))}</p>
      <p class="small">這一頁的圖表需要 <code>/api/trees</code> 的逐筆資料；為了不顯示空圖或過期數字，載入失敗時整頁停在這裡。</p>
      <button class="btn" type="button" data-reload="1">重新載入</button>
    </div>`;
    return {};
  }

  const total = trees.length;
  body.innerHTML = build({ trees, total, meta });

  // 章節跳轉與「隨機看一棵」都走事件委派；inline onclick 會被 CSP script-src 'self' 擋掉。
  // 監聽器掛在 section 上（不是每次產生的內容），離開這一頁時要移除，
  // 否則重複進站會累積多個監聽器，按一次「隨機」會被觸發好幾次。
  const handleStoryClick = (event) => {
    const go = event.target.closest('[data-story-go]');
    if (go) {
      const target = section.querySelector(`#${go.dataset.storyGo}`);
      if (target) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        const heading = target.querySelector('h2');
        if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      }
      return;
    }
    const random = event.target.closest('[data-story-random]');
    if (random) {
      const pick = trees[Math.floor(Math.random() * trees.length)];
      if (pick) window.location.hash = `#/map?tree=${encodeURIComponent(pick.tree_no)}`;
    }
  };
  section.addEventListener('click', handleStoryClick);

  return { destroy: () => section.removeEventListener('click', handleStoryClick) };
}
