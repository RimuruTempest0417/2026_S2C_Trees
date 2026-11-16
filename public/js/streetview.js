/**
 * 頁面內街景（不跳外站、不需要 API key）
 *
 * 用 Google 地圖「分享 → 嵌入地圖」產生的 embed 網址格式：
 *   https://www.google.com/maps/embed?pb=!4v<毫秒時間戳>!6m8!1m7!1s0x0:0x0
 *     !2m2!1d<緯度>!2d<經度>!3f<水平角>!4f<俯仰角>!5f<視野>
 *
 * 為什麼是 `!1s0x0:0x0`：那一格原本是「全景 ID（pano id）」，但實測填 0x0:0x0
 * 時 Google 會依後面的座標自動找最近的全景——所以只要先有座標，就能在使用者
 * 端即時組出任何位置（658 株樹不必逐一存連結，也不必存 658 個 embed 網址）。
 *
 * 驗證（真實瀏覽器 iframe）：
 *   !1s<真 pano id> + 座標  → 正常街景
 *   !1s0x0:0x0 + 座標       → 正常街景（自動取最近全景）✓
 *   !1s 空白 + 座標         → 黑畫面
 *   沒有 !6m8               → 變成地圖（不是街景）
 */

const EMBED = 'https://www.google.com/maps/embed?pb=';

/** 依座標組出頁面內街景網址（heading：0=北，90=東；fov：1 ≈ 預設視野） */
export function streetViewEmbedUrl(lat, lon, { heading = 0, pitch = 0, fov = 1.2 } = {}) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return '';
  const ts = Date.now();
  const h = Number.isFinite(Number(heading)) ? Number(heading) : 0;
  const p = Number.isFinite(Number(pitch)) ? Number(pitch) : 0;
  const f = Number.isFinite(Number(fov)) ? Number(fov) : 1.2;
  return `${EMBED}!4v${ts}!6m8!1m7!1s0x0:0x0!2m2!1d${la.toFixed(7)}!2d${lo.toFixed(7)}!3f${h}!4f${p}!5f${f}`;
}

const STYLE = `
.sv-backdrop{position:fixed;inset:0;background:rgba(6,10,8,.9);z-index:1200;display:flex;align-items:center;justify-content:center;padding:1rem}
.sv-panel{position:relative;width:min(1120px,96vw);height:min(740px,88vh);background:var(--card,#121814);
  border:1px solid var(--border,#2a3630);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 18px 60px rgba(0,0,0,.5)}
.sv-head{display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-bottom:1px solid var(--border,#2a3630)}
.sv-title{font-size:.92rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-attrib{font-size:.72rem;opacity:.7;margin-left:.4rem}
.sv-close{margin-left:auto;background:none;border:0;color:inherit;font-size:1.45rem;line-height:1;cursor:pointer;padding:.1rem .35rem}
.sv-frame{flex:1;min-height:0;border:0;width:100%;background:#000}
.sv-note{padding:1rem;font-size:.85rem;line-height:1.6}
`;

function ensureStyle() {
  if (document.getElementById('sv-style')) return;
  const st = document.createElement('style');
  st.id = 'sv-style';
  st.textContent = STYLE;
  document.head.appendChild(st);
}

let current = null;

/** 關掉目前的街景（如果有的話） */
export function closeStreetView() {
  if (!current) return;
  document.removeEventListener('keydown', current.onKey);
  current.el.remove();
  current = null;
}

/** 在頁面內開一個街景面板（iframe），不開新分頁 */
export function openStreetView({ lat, lon, label = '', heading = 0 }) {
  const url = streetViewEmbedUrl(lat, lon, { heading });
  if (!url) {
    window.alert('這株樹沒有座標，無法顯示街景。');
    return;
  }
  ensureStyle();
  closeStreetView();

  const el = document.createElement('div');
  el.className = 'sv-backdrop';
  el.innerHTML = `
    <div class="sv-panel" role="dialog" aria-modal="true" aria-label="街景">
      <div class="sv-head">
        <span class="sv-title">街景${label ? ` · ${label}` : ''}<span class="sv-attrib">影像 © Google</span></span>
        <button class="sv-close" type="button" aria-label="關閉街景">×</button>
      </div>
      <iframe class="sv-frame" title="Google 街景" loading="lazy" allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin" src="${url}"></iframe>
    </div>`;
  document.body.appendChild(el);

  const onKey = (e) => { if (e.key === 'Escape') closeStreetView(); };
  el.querySelector('.sv-close').addEventListener('click', closeStreetView);
  el.addEventListener('click', (e) => { if (e.target === el) closeStreetView(); });
  document.addEventListener('keydown', onKey);
  current = { el, onKey };
}
