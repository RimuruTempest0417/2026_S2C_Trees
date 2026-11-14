/**
 * Neon 模式的查詢形狀測試 —— 不需要真的連上資料庫。
 *
 * 做法：攔截 fetch，檢查送往 Neon HTTP endpoint（`/sql`）的 SQL 與參數。
 * 為什麼要守這一層：線上事故「路綫推薦只出現 Cannot read properties of null」的根因是
 * 後端用 rpc_scatter 當候選來源，它只回傳 (tree_no, age_years, height_m, species, parish, health)
 * —— 沒有 lat/lon，候選點全被座標檢查濾掉，路綫推薦回 {route: null, stops: []}。
 * 本機 snapshot 模式不會重現，所以直接驗證「我們送出的 SQL」。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgresql://user:pass@ep-test.ap-southeast-1.aws.neon.tech/neondb';

const repo = await import('../lib/repo.js');

const neonJson = (rows) => new Response(JSON.stringify({
  command: 'SELECT', rowCount: rows.length, oid: null,
  fields: Object.keys(rows[0] || {}).map((name) => ({ name, dataTypeID: 25 })),
  rows: rows.map((r) => Object.values(r)),
}), { status: 200, headers: { 'content-type': 'application/json' } });

function stub(handler) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    const call = { url: String(url), method: init.method || 'POST', body };
    calls.push(call);
    return handler(call);
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('測試前提：這支測試確實跑在 Neon 模式', () => {
  assert.equal(repo.DATA_SOURCE, 'neon');
});

test('allTrees() 的 SQL 必須包含座標（線上事故的回歸測試）', async () => {
  const { calls, restore } = stub(() => neonJson([{
    tree_no: '1', age_years: 100, official_age_years: 100, height_m: 12.5,
    species: '樹種', parish: '大堂區', site: '站', health: '健康', grade: '一級',
    official_health: '健康', official_grade: '一級', lat: 22.1992, lon: 113.5409,
    diameter_cm: 80, official_loc: 'x', crown_m: 10, tree_photo: null,
    photo_count: 0, tree_geo_precision: 'official',
  }]));
  try {
    const rows = await repo.allTrees();
    const call = calls[0];
    assert.match(call.url, /\/sql$/, 'Neon HTTP driver 應該打 /sql');
    const sql = call.body.query;
    assert.ok(sql.includes('from public.v_trees'), `allTrees 應從 v_trees 取資料，實際 SQL：${sql}`);
    for (const col of ['tree_no', 'species', 'parish', 'health', 'grade', 'age_years', 'height_m', 'lat', 'lon']) {
      assert.ok(sql.includes(col), `allTrees 的 SQL 沒有帶 ${col}`);
    }
    assert.ok(!/rpc_scatter/.test(sql), 'allTrees 不得再呼叫 rpc_scatter（它沒有回傳座標）');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].lat, 22.1992);
    assert.equal(rows[0].lon, 113.5409);
  } finally {
    restore();
  }
});

test('findTrees()：有官方值條件時，SQL 不帶 grade／health／年齡（改在 JS 用顯示值篩）', async () => {
  const { calls, restore } = stub(() => neonJson([]));
  try {
    await repo.findTrees({ grade: '一級', min_age: 100, limit: 10 });
    const { query, params } = calls[0].body;
    assert.match(query, /public\.rpc_find_trees\(\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10,\$11,\$12,\$13,\$14,\$15,\$16\)/,
      `參數必須逐一帶入（不可拼接字串），實際：${query}`);
    assert.equal(params.length, 16, `rpc_find_trees 有 16 個參數，實際 ${params.length}`);
    assert.equal(params[2], null, 'p_grade 應該留空（由 JS 篩顯示值）');
    assert.equal(params[3], null, 'p_health 應該留空');
    assert.equal(params[4], null, 'p_min_age 應該留空');
    assert.equal(Number(params[14]), 2000, '需要 JS 重篩時，先取回全部（p_limit=2000）');
    assert.equal(Number(params[15]), 0, 'p_offset 應為 0');
  } finally {
    restore();
  }
});

test('getTree() 用參數化查詢，不得把使用者輸入拼進 SQL', async () => {
  const { calls, restore } = stub(() => neonJson([{ tree_no: '1132', grade: '不分級', official_grade: '不分級' }]));
  try {
    const t = await repo.getTree('1132');
    const { query, params } = calls[0].body;
    assert.match(query, /where tree_no = \$1/);
    assert.deepEqual(params, ['1132']);
    assert.equal(t.tree_no, '1132');
    assert.equal(t.grade, '不分級', '單株詳情必須套用官方值優先（officialFirst）');
  } finally {
    restore();
  }
});

test('關鍵字查詢也走參數化（SQL injection 守門）', async () => {
  const { calls, restore } = stub(() => neonJson([]));
  try {
    await repo.getTopic("x'); drop table trees; --");
    const { query, params } = calls[0].body;
    assert.match(query, /where slug = \$1/);
    assert.equal(params[0], "x'); drop table trees; --");
    assert.ok(!query.includes('drop table'), '使用者輸入不得出現在 SQL 字串裡');
  } finally {
    restore();
  }
});

test('健康檢查的探測 SQL 只讀取 public schema 的物件', async () => {
  const { calls, restore } = stub(() => neonJson([{ ok: 1 }]));
  try {
    await repo.healthCheck();
    const sqls = calls.map((c) => c.body.query);
    for (const s of sqls) {
      assert.ok(!/supabase|auth\./i.test(s), `探測不得引用 Supabase 專屬物件：${s}`);
    }
    assert.ok(sqls.some((s) => /public\.v_trees/.test(s)), '應探測 v_trees');
    assert.ok(sqls.some((s) => /rpc_find_trees/.test(s)), '應探測 rpc_find_trees');
  } finally {
    restore();
  }
});
