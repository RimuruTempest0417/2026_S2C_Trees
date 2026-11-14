# 安全性政策（Security Policy）

## 支援範圍

本專案是澳門古樹保育研究平台（教學／研究用途）。我們只維護 `main`（發佈版）與 `develop`（開發整合）的最新版本。

| 版本 | 是否支援 |
|---|---|
| `1.x` 最新版 | ✅ |
| 舊版（含 `0.x`） | ❌ 不另行修補 |

## 回報安全問題

**請不要用公開 issue 回報安全問題。**

1. 用 GitHub 的 **Private vulnerability reporting**：
   <https://github.com/RimuruTempest0417/2026_S2C_Trees/security/advisories/new>
2. 或在 repo 的 `Security` → `Report a vulnerability` 填寫。

請盡量附上：

- 影響的頁面或 API 端點（例如 `#/priority`、`/api/trees`）
- 重現步驟
- 你認為的影響（資料外洩／服務中斷／權限提升）
- 你的瀏覽器與裝置

## 我們的處理方式

| 階段 | 目標時間 |
|---|---|
| 確認收到 | 3 天內 |
| 初步評估與回覆 | 7 天內 |
| 修補並發佈 | 視嚴重程度，14 天內 |

修補完成後，我們會在 Release 說明中致謝（除非你要求匿名）。

## 本專案已知的設計取捨

- 「實地考察紀錄」是公開寫入端點（無需登入）：這是教學設計，我們以長度上限、值域白名單與伺服器端驗證降低風險。
- CSP 的 `style-src` 含 `'unsafe-inline'`：Leaflet、KaTeX 與本專案樣板都需要行內樣式；`script-src` 維持嚴格 `'self'`。

## 不在範圍內

- 由 GitHub／Vercel／Neon 平台本身提供的功能（請直接向該平台回報）
- 需要實體接觸設備或社交工程的攻擊
- 阻斷服務（DoS）測試
