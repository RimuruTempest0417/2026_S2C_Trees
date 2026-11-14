# 給同學的交接說明（可直接轉貼）

> 這份同時是「給同學本人看的」與「貼給他的 Hermes 看的」。要轉貼的話，把**第一節到第六節**整段複製給他就好。
>
> 專案：<https://github.com/RimuruTempest0417/2026_S2C_Trees>
> 維護者：Gary（GitHub `RimuruTempest0417`）｜合作者：`shimianyizhimiao`

---

## 一、先把環境跑起來（三件事）

**1. 接受 GitHub 協作邀請**

信箱會有 GitHub 的 invitation，或直接開 <https://github.com/RimuruTempest0417/2026_S2C_Trees> 右上角按接受。帳號是 `shimianyizhimiao`。

**2. 把專案拉到你的電腦**

⚠️ 這個 repo 的歷史在 2026-11-14 重寫過（清掉了誤上傳的檔案）。**如果你以前 clone 過，請刪掉重 clone**，不要用舊的。

```bash
git clone https://github.com/RimuruTempest0417/2026_S2C_Trees.git
cd 2026_S2C_Trees
npm install
npm run dev
```

打開 <http://localhost:3000> 應該就看得到網站。

**3. 不需要資料庫、也不需要跟我要密碼**

沒有 `.env.local` 時，程式會自動讀 repo 內的資料快照（本機模式），畫面上會標示目前資料來源。**不要跟我要 `DATABASE_URL`，也不要自己申請雲端資料庫**——本機開發用快照就夠，正式站由我維護。

---

## 二、你的地盤：分支與 PR

| 誰 | 分支前綴 | 例子 |
|---|---|---|
| Gary | `gary/` | `gary/codeowners-miao` |
| 你 | `miao/` | `miao/arcgis-map-merge` |

```bash
git switch develop && git pull
git switch -c miao/你的功能
# 改完
git add -A && git commit -m "feat: 一句話說明做了什麼"
git push -u origin miao/你的功能
```

然後在 GitHub 開 **PR 對 `develop`**（不是 `main`），合併方式用 **Squash and merge**。

**規則（已由分支保護強制）**

- `develop`：可以直接推，但**禁止刪除、禁止 force push**
- `main`：**只能透過 PR**，需要 **1 人批准** ＋ **Code Owners 審查**（`CODEOWNERS` 指向我與你）＋ 禁止 force push
- `main` 的 PR 若被 CodeQL 找到 high 等級以上的問題，會被自動擋下
- 功能分支（`miao/*`）沒有任何限制，可以自由推、自由刪

---

## 三、規則在哪裡

| 文件 | 給誰看 | 內容 |
|---|---|---|
| [`CONTRIBUTING.md`](../../CONTRIBUTING.md) | 人 | 分支模型、PR 規則、版本編號、不要做的事 |
| [`AGENTS.md`](../../AGENTS.md) | AI 代理 | 必跑測試、資料層寫法、健康檢查清單 |
| [`.github/CODEOWNERS`](../../.github/CODEOWNERS) | GitHub | 哪些檔案一定要誰審查 |

---

## 四、送 PR 前一定要跑（三項全過）

```bash
npm test                          # 目前 393 項
npm run check                     # 語法檢查（95 檔）
node scripts/build-sw.mjs --check # Service Worker 預載清單
```

PR 模板會自動帶入檢查清單，照著勾。

---

## 五、絕對不要做的事

- ❌ 不要把 `.env`、`.env.local`、任何金鑰或連線字串 commit 進去（`.gitignore` 已擋，別用 `git add -f` 硬加）
- ❌ 不要直接 push 到 `main`；也不要對 `main`／`develop` force push
- ❌ 不要改 `data/`、`db/`、`lib/repo.js`——那裡是官方數值（分級、胸徑、胸圍、樹齡、健康）與資料結構，由我把關
- ❌ 不要在 `public/` 出現「作業」二字（有自動測試會擋）
- ❌ 不要引入 CDN，第三方套件一律放 `public/vendor/`
- ❌ 版本只走 `1.x`：功能 `1.N.0`、修正 `1.N.M`，**不要出現 2.0.0**

---

## 六、下一步：你的作品怎麼併進來

**先不要急著搬檔案。** 先確認上面跑得起來、讀過 `AGENTS.md`，然後告訴我這三件事：

1. 你的作品是不是單檔 `index.html`？大概多大？
2. 657 張照片放在哪、檔名規則是什麼、總容量多少？
3. 地圖用什麼（ArcGIS JS API？版本？金鑰從哪來？）

我會告訴你放到哪個資料夾（例如 `public/partner/`）、照片怎麼命名與壓縮、以及從主站哪個位置加一個入口。**合併方式由我決定後再動手**，避免你白搬一次。

---

## 七、貼給你的 Hermes 的開場指令（可直接複製）

```
你在 2026_S2C_Trees 這個 repo 工作（GitHub: RimuruTempest0417/2026_S2C_Trees）。
先完整讀 AGENTS.md、CONTRIBUTING.md、docs/onboarding/teammate-brief.md，然後：

1. 只在 miao/* 分支上改；不直接 push main 或 develop；完成後提醒我開 PR 到 develop（Squash and merge）。
2. 官方資料（分級、胸徑、胸圍、樹齡、健康）一律用 official_* 欄位，不得改、不得換算、不得自行分級。
3. 每次改完都跑 npm test、npm run check、node scripts/build-sw.mjs --check，三個都過才算完成。
4. 不要 commit .env／金鑰／掃描報告；不要在 public/ 出現「作業」二字；不要引入 CDN。
5. 版本只走 1.x：功能 1.N.0、修正 1.N.M，不出現 2.0.0。
6. 不要改 data/、db/、lib/repo.js 的資料結構；不要動 Vercel／Neon 設定；有疑問先問我。
7. 本機不需要資料庫連線（沒有 .env.local 時自動用資料快照）。
```
