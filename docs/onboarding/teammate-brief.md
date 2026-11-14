# 給新同學（和他的 Hermes）的交接說明

> 這份是給「另一個用 Hermes Agent 開發這個專案的人」看的。貼給你的 Hermes，或自己照做。

## 一、先做這三件事

1. **接受 GitHub 邀請**（信箱裡的 invitation，或 <https://github.com/RimuruTempest0417/2026_S2C_Trees> 右上角）
2. **clone 並安裝**

   ```bash
   git clone https://github.com/RimuruTempest0417/2026_S2C_Trees.git
   cd 2026_S2C_Trees
   npm install
   ```

3. **問 repo owner 拿本機用的 `DATABASE_URL`**（Neon 連線字串），存進 `.env.local`（**不要** commit）。沒有它也能跑，只是會進入唯讀的示範模式（畫面上會標示）。

## 二、你的地盤

| 你 | 分支前綴 | 例 |
|---|---|---|
| 張衍霖 | `gary/` | `gary/neon-migration` |
| 你 | `miao/` | `miao/gallery-zoom` |

```bash
git switch develop && git pull
git switch -c miao/你的功能
# 做完
git add -A && git commit -m "feat: 一句話說明"
git push -u origin miao/你的功能
```

然後在 GitHub 開 PR **對 `develop`**（不是 `main`）。

## 三、規則在哪

- 人類版：[`CONTRIBUTING.md`](../CONTRIBUTING.md)（分支、PR、版本編號、不要做的事）
- AI 代理版：[`AGENTS.md`](../AGENTS.md)（給你的 Hermes 讀；包含必跑測試與資料層寫法）

## 四、貼給你 Hermes 的開場指令（可直接複製）

```
你在 ~/2026_S2C_Trees 這個 repo 工作。先讀 AGENTS.md 與 CONTRIBUTING.md，然後：
1. 只在 miao/* 分支上改，不推 main 或 develop；完成後提醒我開 PR 到 develop。
2. 官方資料（分級、胸徑、胸圍、樹齡、健康）不得改、不得換算、不得自行分級。
3. 每次改完都跑 npm test（393 項）、npm run check、node scripts/build-sw.mjs --check，三個都過才算完成。
4. 不要 commit .env／金鑰／ZAP 報告；不要在 public/ 出現「作業」二字；不要引入 CDN。
5. 版本只走 1.x：功能 +0.1、修正 +0.0.1，不出現 2.0.0。
6. 有疑問先問我，不要自己改資料庫結構或 Vercel 設定。
```

## 五、送 PR 前

```bash
npm test
npm run check
node scripts/build-sw.mjs --check
```

三項全過再開 PR；PR 會自動帶入檢查清單。
