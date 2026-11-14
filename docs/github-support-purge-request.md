# 請 GitHub Support 清除舊 commit 快取（可直接貼上）

## 為什麼要送

我們已用 `git filter-repo` 把敏感資料從**所有分支與 tag** 移除，但 GitHub 仍保留「快取檢視」：知道舊 SHA 的人還是能打開舊 commit 與 raw 檔案。實測：

```
https://github.com/RimuruTempest0417/2026_S2C_Trees/commit/7c1a75e            → 200
https://raw.githubusercontent.com/…/7c1a75e/prof-…/Default/Cookies          → 200
```

GitHub 官方文件（Removing sensitive data from a repository）說明：重寫歷史後要**另外請 GitHub Support 清除快取**。

## 怎麼送

1. 用**專案擁有者**帳號登入 GitHub
2. 開 <https://support.github.com/contact>
3. 選擇：**Repository** → **Sensitive data**（若沒有這個選項，選 `Other` 並在標題寫 `Request to purge cached views after history rewrite`）
4. 貼上下面整段英文
5. 送出後把工單編號回報給我，我之後幫你追蹤

---

## 貼上這段（英文）

```
Subject: Request to purge cached views after history rewrite (sensitive data)

Hello GitHub Support,

I have rewritten the full history of my public repository to remove sensitive data that was committed by mistake. The rewrite is complete on all branches and tags, and the old commits are no longer reachable from any ref.

Repository: RimuruTempest0417/2026_S2C_Trees
New HEAD: 9ebcd1d
Rewrite performed: 2026-11-14 (Asia/Macau), using git filter-repo

Sensitive data that was removed from history:
1. A Chrome browser profile directory "prof-微細懸浮粒子/" (484 files, ~6.7 MB) containing Cookies, History, Local Storage and Client Certificates. It was introduced in September 2026 and deleted from the working tree afterwards, but remained in history.
2. A .env.example file that contained a Supabase project URL and JWT keys. The Supabase project has since been deleted, so those keys are revoked.

The cached views are still serving that content, for example:
- https://github.com/RimuruTempest0417/2026_S2C_Trees/commit/7c1a75e
- https://raw.githubusercontent.com/RimuruTempest0417/2026_S2C_Trees/7c1a75e/prof-%E5%BE%AE%E7%B4%B0%E6%87%B8%E6%B5%AE%E7%B2%92%E5%AD%90/Default/Cookies

Old commits that contain the data: 7c1a75e (Chrome profile), 1fcd74c^ (leaked keys), e2af3f1 (pre-rewrite main tip).

Could you please purge the cached views / dangling objects for this repository so those URLs stop returning the content?

Thank you very much.
```

---

## 送出後

- 一般 **1–3 個工作天**回覆；清除完成後，舊 commit 網址會變成 404
- 在這段時間，repo 可以維持 public（我們已把敏感資料從新歷史移除，只剩舊快取）
- 若 Support 回覆說需要額外資訊（例如要你確認擁有權），把回覆貼給我，我幫你寫下一封
