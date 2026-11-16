# 參與開發（Contributing）

本專案是「澳門古樹保育研究平台」：前端原生 JavaScript／Leaflet／Chart.js，後端 Vercel Serverless Functions，資料庫 PostgreSQL。
**介面文字、文件、程式註解一律繁體中文。**

## 1. 先讀這三條鐵律

1. **官方資料不得改**：分級、胸徑、胸圍、樹齡、健康一律採用市政署公布值（`official_*`），不得換算、估算或自行分級。
2. **金鑰不進版控**：`.env`、任何金鑰、`*ZAP-Report*.html` 一律不得 commit。
3. **`main` 只放發佈版**：日常開發推 `develop`；`develop` 通過檢查後才合併到 `main`。

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
| `main` | 對外發佈版（Vercel production） | 只有 repo owner；**`develop` 檢查通過後**才合併 |
| `develop` | 日常開發整合 | 經 PR 合併 |
| `gary/*`、`miao/*` | 個人工作分支 | 自己 |

`gary/xxx` 或 `miao/xxx` → `develop` →（檢查通過）→ `main` → 發 Release。

### 每次開發的流程（2026-11-16 起）

1. 在自己的分支或 `develop` 上完成改動
2. 推上 **`develop`**
3. 在 `develop` 跑完三項檢查（見第 7 節），全過才繼續
4. 由 repo owner 把 `develop` 合併到 `main`（merge commit），Vercel 自動部署
5. 需要時發 Release 與 tag

> 目的：`main` 永遠是可對外展示的版本；`develop` 可以有進行中的改動。

### 每個人的工作分支

分支就等於每個人的「工作區」，請用自己的名字當前綴，避免撞名：

| 人 | 分支前綴 | 例子 |
|---|---|---|
| 張衍霖（owner，`@RimuruTempest0417`） | `gary/` | `gary/neon-migration`、`gary/fix-print` |
| 同學（`@shimianyizhimiao`） | `miao/` | `miao/gallery-zoom`、`miao/fix-css` |

規則：**只在自己的前綴分支上工作**，不要動別人的分支；合併一律走 PR，不直接推 `develop` 或 `main`。

## 4. 分工與同步節奏

### 誰改哪裡（減少撞車）

| 範圍 | 負責 | 規則 |
|---|---|---|
| `lib/`、`api/`、`db/`、`data/` | `@RimuruTempest0417` | 資料層與官方數值；`@shimianyizhimiao` 要改先講 |
| `public/js/`、`public/css/`、`public/index.html` | `@RimuruTempest0417` ＋ `@shimianyizhimiao`（共同） | 兩人共同維護；同一個檔案不要同時改，改前在 PR 說明 |
| `public/partner/` | `@shimianyizhimiao` | 專題頁面與相片，`@RimuruTempest0417` 不主動改 |
| `docs/`、`.github/` | 兩人共同 | 文件與協作設定，改動前在 PR 說明 |
| `vercel.json`、`package.json` | `@RimuruTempest0417` | 部署與依賴；改動前先通知另一人 |

**原則**：不是「不能碰」，而是「碰之前講一聲」。只有兩人改到同一個檔案才會產生 conflict；不同檔案 Git 會自動合併。

### 同步節奏（每天）

```bash
# 開工前
git switch develop && git pull

# 開自己的分支
git switch -c miao/你的功能     # Gary 用 gary/

# 推送前（若 develop 已前進）
git fetch origin
git rebase origin/develop       # 只 rebase 自己的分支，不要 rebase develop
```

- **每次動手改程式前都要同步**（不是每週）：先 `git switch develop && git pull`，確認你是在最新的 `develop` 上開分支
- **開工時先宣告要改哪些檔案**：開一個 **Draft PR**（或 issue），標題寫 `WIP: 要改什麼`，內文列出會動到的檔案，例如
  `會改：public/js/map.js、public/css/style.css`
- **看到對方也在改同一支檔案**：先在 PR 留言講好順序，後改的人負責解 conflict
- **推送後在 PR 留一句「已推，請 pull」**：對方在 GitHub 會收到通知（`Watch` → `Custom` → 勾 `Pull requests`）
- **不要 rebase 或 force push `develop` / `main`**（規則會擋，也沒有必要）
- 分支壽命建議 **3 天內**合併；拖太久 conflict 機率大增

### 不要用雲端硬碟同步這個 repo

iCloud、OneDrive、Google Drive 會產生「`xxx 2.jpg`」這種衝突副本，嚴重時會弄壞 `.git`。

> 實際發生過：2026-11-14 在 `public/partner/相片/` 清掉 **387 個** iCloud 衝突副本（照片檔名被加上「 2」）。

同步一律走 GitHub：`pull` / `push` 就是同步機制。

## 5. 開工三步

```bash
git switch develop && git pull
git switch -c gary/你的功能        # 同學用 miao/
# 做完
git add -A && git commit -m "feat: 一句話說明"
git push -u origin gary/你的功能
```

然後在 GitHub 開 PR **對 `develop`**，標題寫 `feat: …`。

## 6. PR 規則

- 標題：`feat:`／`fix:`／`docs:`／`test:`／`chore:` 開頭，後面一句話
- 內文要寫「改了什麼／怎麼驗的」，並連到對應 issue（`Closes #12`）
- 功能分支 → `develop`：**Squash and merge**
- `develop` → `main`：**Create a merge commit**
- 不要 force push 已經被別人拉過的分支

## 7. 送 PR 前自己先跑

```bash
npm test                      # 全部測試必須綠燈（目前 399 項）
npm run check                 # 語法檢查
node scripts/build-sw.mjs --check   # PWA 預載清單要與版本一致
```

三個沒過就不要開 PR。

## 8. 不要做的事

- 不要直接推 `main`（`main` 只接受從 `develop` 合併、且檢查已通過的版本）
- 不要 commit `.env`、金鑰、`node_modules/`、`*ZAP-Report*.html`
- 不要引入 CDN 依賴：第三方函式庫一律放 `public/vendor/`（離線 PWA 需要）
- 不要改官方數值或自創分級；發現官方資料變動請開 issue
- 不要在 `public/` 出現「作業」字樣（介面用語已定案）

## 9. 給審查的人（checklist）

- [ ] 有沒有動到 `official_*` 數值或分級邏輯
- [ ] 測試有沒有跟著更新（新增功能要加測試）
- [ ] 手機 390px 寬有沒有橫向溢出
- [ ] 深色模式與列印樣式有沒有壞
- [ ] 有沒有新引入的第三方來源（CSP 白名單要跟著改）

## 10. 版本編號規則

**主版號固定在 `1`，不進入 `2.x.x`。**

| 類型 | 版號 | 例子 |
|---|---|---|
| 新功能、新頁面 | `1.N.0` | 1.1.0、1.2.0 |
| 修 bug、調整文案 | `1.N.M` | 1.1.1、1.1.2 |
| 大改架構 | 仍留在 `1.x`，必要時 `1.99.0` 之後改 `1.100.0` | 不出現 2.0.0 |

發版流程：`package.json`、`lib/repo.js` 的 `API_VERSION`、`public/sw.js` 的 `VERSION` 三處要一致，並同時更新 `docs/releases/<版本>.md`。

## 11. 有問題

開 issue（用內建模板）或直接在 PR 留言。不確定就先問，不要先改設定或資料庫。
