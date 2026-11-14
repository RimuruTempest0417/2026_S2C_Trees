# PR 審查與確認：按鈕在哪、要點什麼

> 給合作者（`shimianyizhimiao`）與他的 AI 代理。以本專案為例，但流程對所有 GitHub PR 都一樣。

## 一句話版本

**你收到「有人開 PR 給你」→ 看 Checks 是不是綠 → 按 `Review changes` → 選 `Approve` → `Submit review`。**
**你自己開的 PR → 等 Gary 批准，你不要按 Merge。**

---

## 零、動手前先宣告（每次改程式，不是每週）

**規則：每次要動程式碼之前，先在 GitHub 宣告你要改哪些檔案。** 這是為了避免兩個人同時改同一支檔案。

1. **先同步**：`git switch develop && git pull`
2. **開一個 Draft PR**（或 issue）宣告：
   - 標題：`WIP: 一句話說要改什麼`
   - 內文：`會改：public/js/map.js、public/css/style.css`
   - 開 Draft 的方法：`Create pull request` 按鈕旁邊的小箭頭 → **`Create draft pull request`**
3. **看到對方已經在改同一支檔案** → 在他的 PR 留言講好順序，**後改的人負責解 conflict**
4. **推送後** → 在自己的 PR 留一句「已推，請 pull」；準備好就按 **`Ready for review`**（Draft → 正式 PR）

> 收通知的方法：repo 右上 `Watch` → `Custom` → 勾 **`Pull requests`**。

---

## 一、別人開 PR 要你批准（最常見）

### 步驟 1：打開 PR

到 <https://github.com/RimuruTempest0417/2026_S2C_Trees/pulls>，點那張 PR。

### 步驟 2：確認 Checks 全部通過

PR 頁面往下捲，會看到一區 **Checks**（或左側 `Checks` 分頁）：

| 看到什麼 | 意思 | 你要做什麼 |
|---|---|---|
| 綠色 ✓ `Vercel`、`CodeQL` | 都通過了 | 可以批准 |
| 黃色圓圈 | 還在跑 | 等 1–3 分鐘，重新整理 |
| 紅色 ✗ | 有問題 | **先不要批准**，按 `Details` 看原因，把訊息貼給 Gary |

### 步驟 3：按批准

1. 右上角找 **`Review changes`** 按鈕（在 `Files changed` 分頁裡也有）
2. 彈出視窗選 **`Approve`**（不要選 `Comment` 或 `Request changes`）
3. 想留話可以在框裡寫一句，例如「確認過，可以合併」
4. 按 **`Submit review`**

### 步驟 4：完成後

你會看到 PR 上出現綠色的「approved」。**接下來由 Gary 按 `Merge pull request`**——你不需要按，也不用按 `Delete branch`。

---

## 二、你自己開 PR

1. 推你的分支：`git push -u origin miao/你的功能`
2. GitHub 會提示 **`Compare & pull request`** → 點它
3. 確認 **base 是 `develop`**（不是 `main`），標題用中文寫做了什麼
4. 按 **`Create pull request`**
5. 等 Gary 批准，**由 Gary 合併**（Squash and merge）

> 如果 Gary 請你自己合 `develop` 的 PR，才按 **`Squash and merge`**。

---

## 三、看到紅燈（Check failed）怎麼辦

| 紅的是什麼 | 常見原因 | 怎麼處理 |
|---|---|---|
| `CodeQL` | 你的程式被掃到 high 等級問題（有時是誤判，例如測試裡的字串比對） | 點 `Details` 看檔案與行號；**不要自己按 `Dismiss alert`**，先告訴 Gary |
| `Vercel` | 建置失敗（語法錯誤、檔案路徑錯） | 點 `Details`，把最後 20 行錯誤貼給 Gary |
| `Review required` | 這是正常狀態，不是錯誤 | 等 Gary 批准 |
| `Unresolved conversations` | 有討論串沒標解決 | 在 `Conversation` 分頁逐條按 `Resolve conversation` |

---

## 四、絕對不要做的事

- ❌ 不要按 `Merge pull request` 合到 `main`（規則會擋，你也沒有權限）
- ❌ 不要按 `Dismiss alert` 關掉 CodeQL 警示
- ❌ 批准之後又 force push（會讓批准失效，要重新批准）
- ❌ 不要在 PR 裡貼任何金鑰、連線字串、`.env` 內容

---

## 五、如果你要交給自己的 AI 代理做

把下面整段貼給你的 Hermes：

```
你要協助我處理 GitHub PR，但「批准」與「合併」一律由我本人按，你不可以代替我按。

【你可以做的】
1. 用 gh pr list / gh pr view <編號> --json title,state,mergeable,reviewDecision,statusCheckRollup
   查出 PR 的狀態，整理成：Checks 是否全綠、還缺什麼、誰要批准。
2. 用 gh pr checks <編號> 看哪個檢查失敗。
3. 若失敗原因是我們自己程式的錯，修正後推到同一個 miao/* 分支（不要開新 PR）。
4. 用 gh pr comment <編號> --body "..." 留下說明（例如「已修正測試，請重跑」）。

【你不可以做的】
1. 不可以執行 gh pr review --approve（批准必須由我本人按）。
2. 不可以執行 gh pr merge。
3. 不可以關閉或 dismiss 任何 CodeQL／Dependabot／Secret scanning 警示。
4. 不可以修改 branch protection／rulesets／CODEOWNERS。
5. 不可以 force push 到 main 或 develop。

【每次回報格式】
- PR 編號與標題
- Checks：通過 / 失敗（失敗的列出名稱與錯誤摘要）
- 還缺誰批准
- 建議我下一步按哪個按鈕
```
