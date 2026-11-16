# AGENTS.md — 給 AI 代理（Hermes／Codex／Copilot）的工作守則

這份檔案是給「會在這個 repo 動手寫程式的 AI 代理」看的。人類請讀 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。

## 專案是什麼

澳門古樹保育研究平台：原生 JavaScript 前端（`public/`）＋ Vercel Serverless Functions（`api/`、`lib/`）＋ **Neon PostgreSQL**（`db/001_schema.sql`）＋ **Vercel Blob**（現場照片）。介面與文件一律繁體中文。

## 開工前必讀

1. 分支模型：`main`（發佈）← `develop`（整合）← `gary/*`、`miao/*`（個人分支）。**開發推 `develop`；`main` 只在檢查全過後由 owner 合併。**
2. 資料是官方資料（澳門市政署）：分級、胸徑、胸圍、樹齡、健康一律用 `official_*` 欄位，**不得換算、估算或自行分級**。
3. 金鑰不進版控：`.env`、`.env.local`、任何權杖、`*ZAP-Report*.html` 一律不得 commit。

## 修改後一定要跑

```bash
npm test                          # 399 項；任何一項失敗都不算完成
npm run check                     # node --check 掃描全部 JS
node scripts/build-sw.mjs --check # PWA 預載清單要與版本一致
```

改了 `package.json` 的版本時，`lib/repo.js` 的 `API_VERSION` 與 `public/sw.js` 的 `VERSION` 要一起改（`build-sw.mjs` 會處理 sw.js）。

## 資料層

- 連線：`DATABASE_URL`（Neon，`@neondatabase/serverless` 的 HTTP driver）
- 查詢一律**參數化**：`q('select … where tree_no = $1', [treeNo])`；不得把使用者輸入拼進 SQL
- 聚合統計走 `allTrees()` 在 JS 計算，不要另開 SQL 統計（會與畫面上的官方值不一致）
- 健康檢查：`SCHEMA_PROBES`／`RPC_PROBES` 的清單要與 `db/001_schema.sql` 同步
- 照片：`uploadFieldPhoto()` 走 `@vercel/blob` 的 `put()`；測試用 `__setBlobPut()` 替身，不要真的連網

## 前端

- 沒有框架、沒有 bundler：ES Modules 直接載入，第三方函式庫放 `public/vendor/`（離線 PWA 需要，**不得用 CDN**）
- 修正 XSS：一律用 `esc()`／`textContent`，不要把使用者輸入直接塞 innerHTML
- `public/` 不得出現「作業」字樣（介面用語已定案，`tests/ui.test.js` 會擋）
- 行動優先：390px 寬不得橫向溢出；深色模式與列印樣式都要顧

## 測試怎麼寫

- 用 `node:test` ＋ `node:assert/strict`，檔名 `tests/*.test.js`
- 需要資料庫行為時，**攔截 `fetch` 模擬 Neon `/sql` 回應**（見 `tests/db-path.test.js`）；不要在測試裡連真庫
- 陣列欄位（`photo_paths` 等）在假回應中要給 Postgres 陣列字面量 `{"a","b"}` 與 `dataTypeID: 1009`

## 不要做的事

- 不要 `git push --force` 到共用分支
- 不要為了讓掃描器閉嘴而刪掉說明性註解
- 不要在報告或 commit 訊息裡貼任何金鑰、連線字串或指紋
- 不要把 `supabase/` 的舊檔案當成現行綱要（現行是 `db/001_schema.sql`）
