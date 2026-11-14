# 2026_S2C_Trees｜開發看板

澳門古樹保育研究平台的開發進度看板。程式碼在 [RimuruTempest0417/2026_S2C_Trees](https://github.com/RimuruTempest0417/2026_S2C_Trees)。

## 分支

| 分支 | 用途 | 誰可以推 |
|---|---|---|
| `main` | 對外發佈版（Vercel production） | 只有 repo owner（經 PR 合併） |
| `develop` | 日常開發整合 | 經 PR 合併 |
| `feat/*`、`fix/*`、`docs/*` | 個人工作分支 | 自己 |

流程：`feat/xxx` → PR → `develop` →（驗收後）PR → `main` → 發 Release。

## PR 規則

- 標題：`feat: 一句話說明`／`fix: 一句話說明`／`docs: …`
- 一定要連到對應 issue（例如 `Closes #12`）
- 功能分支 → `develop` 用 **Squash and merge**
- `develop` → `main` 用 **Create a merge commit**
- 不要 force push 已經被別人拉過的分支

## 看板欄位

| 欄位 | 意思 |
|---|---|
| Todo | 還沒開始 |
| In progress | 正在做 |
| In review | PR 已開、等對方看過 |
| Done | 已合併／已關閉 |

## 給新加入的人（三步）

1. 接受 GitHub 邀請（信箱，或 repo 頁面右上角）
2. `git clone` 之後執行 `npm install`，照 repo `README.md` 的「本機執行」啟動
3. 從 `develop` 開自己的分支：`git switch -c feat/你的功能 develop`

## 不要做的事

- 不要直接推 `main`
- 不要把 `.env`、金鑰、`*ZAP-Report*.html` commit 進來
- 不要在 `develop` 上直接改（除了 1 行錯字）
