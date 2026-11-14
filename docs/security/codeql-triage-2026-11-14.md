# CodeQL 警示判讀紀錄（2026-11-14）

**掃描設定**：CodeQL Default setup（`actions`、`javascript`、`typescript`、`python`，每週掃描）
**首次掃描結果**：8 筆 `high`（CodeQL 嚴重度），全部判讀後關閉，**0 筆進入 production 執行路徑**。

| # | 規則 | 位置 | 是什麼 | 判定 | 理由 |
|---|---|---|---|---|---|
| 8 | `js/incomplete-url-substring-sanitization` | `tests/security-headers.test.js:76` | 用 `includes()` 檢查 CSP 是否含 OSM 圖磚網域 | `used in tests` | 測試斷言，不進 production；斷言過寬只會讓測試誤判 |
| 7 | `js/stack-trace-exposure` | `scripts/dev-server.mjs:116` | 本機開發伺服器把錯誤堆疊回給瀏覽器 | `won't fix` | 只在開發者電腦執行；對外站台走 `api/*` Serverless Functions |
| 6 | `js/incomplete-multi-character-sanitization` | `tests/text-spacing.test.js:47` | 移除 HTML 標籤後做字串比對 | `used in tests` | 輸入是 repo 內固定樣板字串，非使用者輸入 |
| 5 | `js/bad-tag-filter` | `public/vendor/marked.umd.js:1101` | HTML 註解結束只認 `-->`，不認 `--!>` | `won't fix` | 第三方套件自身程式碼；本專案只渲染自家 Markdown |
| 4 | `js/bad-tag-filter` | `public/vendor/marked.umd.js:1024` | 過濾正則不匹配大寫 `<SCRIPT>` | `won't fix` | 同上 |
| 3 | `js/bad-tag-filter` | `public/vendor/marked.umd.js:1010` | 過濾正則不匹配大寫 `<SCRIPT>` | `won't fix` | 同上 |
| 2 | `js/bad-tag-filter` | `public/vendor/marked.umd.js:974` | 過濾正則不匹配大寫 `<SCRIPT>` | `won't fix` | 同上 |
| 1 | `js/incomplete-sanitization` | `tests/field-photo.test.js:34` | 測試輔助函式轉 Postgres 陣列字面量時未轉義反斜線 | `used in tests` | 只用於假回應，不碰真實資料庫 |

## 為什麼可以這樣判

1. **`public/vendor/` 是內附的第三方套件**（marked.js）。本專案不改 vendor 檔案，升級時整份替換；且 Markdown 來源是 repo 內的自家資料（`data/*.json`、`docs/*.md`），不接受使用者提交內容 → 攻擊面不存在。
2. **`tests/` 與 `scripts/dev-server.mjs` 都不會部署**。Vercel 只發佈 `public/` 與 `api/`（見 `vercel.json`），`scripts/` 不在執行路徑上。
3. **嚴重度是 CodeQL 的靜態分級**，不等於實際可利用性；判讀要看「這段程式會不會在對外站台上跑、輸入從哪來」。

## 後續

- 每次 CodeQL 重掃若出現**新的**警示，先看路徑：`public/js/`、`lib/`、`api/` 之內的要當真處理；`tests/`、`scripts/`、`public/vendor/` 的依上表原則判讀。
- 若上游 marked.js 修正這些正則，升級時會一併消失。
