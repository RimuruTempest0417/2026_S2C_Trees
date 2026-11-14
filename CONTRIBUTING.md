# 參與開發（Contributing）

本專案是「澳門古樹保育研究平台」：前端原生 JavaScript／Leaflet／Chart.js，後端 Vercel Serverless Functions，資料庫 PostgreSQL。
**介面文字、文件、程式註解一律繁體中文。**

## 1. 先讀這三條鐵律

1. **官方資料不得改**：分級、胸徑、胸圍、樹齡、健康一律採用市政署公布值（`official_*`），不得換算、估算或自行分級。
2. **金鑰不進版控**：`.env`、任何金鑰、`*ZAP-Report*.html` 一律不得 commit。
3. **`main` 只放發佈版**：所有人都從 `develop` 開分支，經 PR 合併。

## 2. 本機環境

```bash
node -v          # 需要 20 以上
npm install
cp .env.example .env   # 填入自己的連線資訊；.env 已被 .gitignore 排除
npm run dev            # http://127.0.0.1:3000
```

沒有資料庫也能跑：未設定 `.env` 時會使用內建快照（`snapshot` 模式），畫面上會標示資料來源。

## 3. 分支模型

| 分支 | 用途 | 誰可以推 |
|---|---|---|
| `main` | 對外發佈版（Vercel production） | 只有 repo owner，經 PR 合併 |
| `develop` | 日常開發整合 | 經 PR 合併 |
| `feat/*`、`fix/*`、`docs/*`、`test/*` | 個人工作分支 | 自己 |

`feat/xxx` → PR → `develop` →（驗收後）PR → `main` → 發 Release。

### 每個人的工作分支

分支就等於每個人的「工作區」，請用自己的名字當前綴，避免撞名：

| 人 | 分支前綴 | 例子 |
|---|---|---|
| 張衍霖（owner） | `gary/` | `gary/neon-migration`、`gary/fix-print` |
| 同學 | `miao/` | `miao/gallery-zoom`、`miao/fix-css` |

規則：**只在自己的前綴分支上工作**，不要動別人的分支；合併一律走 PR，不直接推 `develop` 或 `main`。

## 4. 開工三步

```bash
git switch develop && git pull
git switch -c feat/你的功能
# 做完
git add -A && git commit -m "feat: 一句話說明"
git push -u origin feat/你的功能
```

然後在 GitHub 開 PR **對 `develop`**，標題寫 `feat: …`。

## 5. PR 規則

- 標題：`feat:`／`fix:`／`docs:`／`test:`／`chore:` 開頭，後面一句話
- 內文要寫「改了什麼／怎麼驗的」，並連到對應 issue（`Closes #12`）
- 功能分支 → `develop`：**Squash and merge**
- `develop` → `main`：**Create a merge commit**
- 不要 force push 已經被別人拉過的分支

## 6. 送 PR 前自己先跑

```bash
npm test                      # 全部測試必須綠燈
npm run check                 # 語法檢查
node scripts/build-sw.mjs --check   # PWA 預載清單要與版本一致
```

三個沒過就不要開 PR。

## 7. 不要做的事

- 不要直接推 `main`，也不要在 `develop` 上直接改（除了 1 行錯字）
- 不要 commit `.env`、金鑰、`node_modules/`、`*ZAP-Report*.html`
- 不要引入 CDN 依賴：第三方函式庫一律放 `public/vendor/`（離線 PWA 需要）
- 不要改官方數值或自創分級；發現官方資料變動請開 issue
- 不要在 `public/` 出現「作業」字樣（介面用語已定案）

## 8. 給審查的人（checklist）

- [ ] 有沒有動到 `official_*` 數值或分級邏輯
- [ ] 測試有沒有跟著更新（新增功能要加測試）
- [ ] 手機 390px 寬有沒有橫向溢出
- [ ] 深色模式與列印樣式有沒有壞
- [ ] 有沒有新引入的第三方來源（CSP 白名單要跟著改）

## 9. 版本編號規則

**主版號固定在 `1`，不進入 `2.x.x`。**

| 類型 | 版號 | 例子 |
|---|---|---|
| 新功能、新頁面 | `1.N.0` | 1.1.0、1.2.0 |
| 修 bug、調整文案 | `1.N.M` | 1.1.1、1.1.2 |
| 大改架構 | 仍留在 `1.x`，必要時 `1.99.0` 之後改 `1.100.0` | 不出現 2.0.0 |

發版流程：`package.json`、`lib/repo.js` 的 `API_VERSION`、`public/sw.js` 的 `VERSION` 三處要一致，並同時更新 `docs/releases/<版本>.md`。

## 10. 有問題

開 issue（用內建模板）或直接在 PR 留言。不確定就先問，不要先改設定或資料庫。
