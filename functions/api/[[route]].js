/**
 * P1 期間的 API 代理（Cloudflare Pages Functions）。
 *
 * 為什麼需要：Cloudflare Pages 的 `_redirects` **不能**把請求代理到另一個網域
 * （只能做站內 rewrite 或 301/302），所以靜態站上線後 /api/* 會直接 404。
 * 這裡用一支最小的 Function 把請求轉給現有的 Vercel API，
 * 讓 P1（靜態站）可以先獨立驗收，等 P2 把各端點移植過來再刪掉這支。
 */
const UPSTREAM = 'https://old-trees-mylearning.vercel.app';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const target = UPSTREAM + url.pathname + url.search;

  const headers = new Headers(request.headers);
  headers.delete('host');       // 讓 fetch 依目標網域重設
  headers.delete('cf-connecting-ip');

  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  const upstream = await fetch(target, init);
  const out = new Headers(upstream.headers);
  out.set('x-pages-proxy', 'vercel');   // 方便一眼確認「這支還在代打」
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
