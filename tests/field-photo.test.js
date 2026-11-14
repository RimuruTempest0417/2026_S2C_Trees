/**
 * 實地考察照片上傳（/api/photo → Vercel Blob）與結構化欄位的寫入形狀。
 *
 * 為什麼要攔截 fetch 而不是真的上傳：線上事故（Storage bucket 不存在導致「以為上傳成功」）
 * 都發生在「送出的請求形狀」這一層，本機示範模式不會重現。這裡直接驗證：
 * 請求送到哪個端點、帶什麼授權、body 是不是真的圖片位元組、失敗時回什麼訊息
 * （而且訊息要能指出下一步要做什麼）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgresql://user:pass@ep-test.ap-southeast-1.aws.neon.tech/neondb';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_store_token';

const repo = await import('../lib/repo.js');

const BLOB_BASE = 'https://store123.public.blob.vercel-storage.com/field-photos';
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

/**
 * Neon HTTP driver 的回應格式。
 * dataTypeID 要填對，否則陣列欄位（text[] = 1009）會被當成字串回傳：
 *   int4 = 23、text = 25、text[] = 1009
 */
const ARRAY_COLS = new Set(['photo_paths', 'bark_conditions', 'surround_items']);
function typeId(name) {
  if (ARRAY_COLS.has(name)) return 1009;
  if (name === 'id' || name.endsWith('_m') || name.endsWith('_cm')) return 23;
  return 25;
}
/** text[] 在 HTTP 協定裡要送 Postgres 陣列字面量（不是 JSON 陣列），否則 driver 會解析成空陣列 */
const pgArray = (arr) => '{' + arr.map((v) => '"' + String(v).replace(/"/g, '\\"') + '"').join(',') + '}';
const cell = (name, value) => (ARRAY_COLS.has(name) && Array.isArray(value) ? pgArray(value) : value);

const neonJson = (rows) => json({
  command: 'INSERT', rowCount: rows.length, oid: null,
  fields: Object.keys(rows[0] || {}).map((name) => ({ name, dataTypeID: typeId(name) })),
  rows: rows.map((r) => Object.keys(r).map((k) => cell(k, r[k]))),
});

/** 一張 1×1 的 JPEG（最小可用圖檔），base64 之後非常短 */
const TINY_JPEG_B64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/E'
  + 'ABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const TINY_JPEG = `data:image/jpeg;base64,${TINY_JPEG_B64}`;

function stub(handler) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const headers = {};
    const raw = init.headers || {};
    if (typeof raw.forEach === 'function') raw.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    else for (const [k, v] of Object.entries(raw)) headers[k.toLowerCase()] = v;
    const call = {
      url: String(url),
      method: init.method || 'GET',
      headers,
      body: init.body,
      query: init.body && String(url).endsWith('/sql') ? JSON.parse(init.body) : null,
    };
    calls.push(call);
    return handler(call);
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('測試前提：這支測試確實跑在 Neon 模式', () => {
  assert.equal(repo.DATA_SOURCE, 'neon');
});

test('uploadFieldPhoto() 把照片交給 Vercel Blob：正確路徑、權杖、內容型別', async () => {
  const seen = [];
  repo.__setBlobPut(async (pathname, body, options) => {
    seen.push({ pathname, body, options });
    return { url: `${BLOB_BASE}/x.jpg`, pathname };
  });
  try {
    const saved = await repo.uploadFieldPhoto({ dataUrl: TINY_JPEG, treeNo: '1060' });
    assert.equal(seen.length, 1);
    const { pathname, body, options } = seen[0];
    // 路徑形狀：field-photos/日期/樹號-時間-隨機.jpg（樹號只留安全字元）
    assert.match(pathname, /^field-photos\/\d{4}-\d{2}-\d{2}\/1060-[a-z0-9]+-[a-z0-9]+\.jpg$/);
    assert.ok(body instanceof Uint8Array || Buffer.isBuffer(body), 'body 要是圖片位元組');
    assert.equal(options.access, 'public', '照片要能直接被 <img> 讀取');
    assert.equal(options.contentType, 'image/jpeg');
    assert.equal(options.token, 'vercel_blob_rw_test_store_token', '必須帶 Blob 讀寫權杖');
    assert.equal(saved.stored, true);
    assert.ok(saved.url.startsWith('https://'), '回傳的必須是可直接顯示的公開網址');
    assert.ok(saved.bytes > 0);
  } finally {
    repo.__setBlobPut(null);
  }
});

test('uploadFieldPhoto() 擋掉非圖片的 data URL、過大的檔案', async () => {
  const { restore } = stub(() => json({}));
  try {
    await assert.rejects(() => repo.uploadFieldPhoto({ dataUrl: 'https://evil.example/x.jpg' }),
      /data URL/, '外部網址不得當成上傳內容');
    await assert.rejects(() => repo.uploadFieldPhoto({ dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' }),
      /JPEG／PNG／WebP|data URL/, '只接受圖片型別');
    // 4,194,312 個 base64 字元 → 解碼後超過 3 MB 上限
    await assert.rejects(() => repo.uploadFieldPhoto({ dataUrl: `data:image/jpeg;base64,${'A'.repeat(4 * 1024 * 1024 + 8)}` }),
      (err) => /照片過大/.test(err.message) && err.status === 413, '過大的照片要回 413 並說清楚');
  } finally {
    restore();
  }
});

test('沒有設定 BLOB_READ_WRITE_TOKEN 時，訊息要指出下一步', async () => {
  const savedToken = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  repo.__setBlobPut(async () => ({ url: 'https://x/y.jpg' }));
  try {
    await assert.rejects(() => repo.uploadFieldPhoto({ dataUrl: TINY_JPEG }), (err) => {
      assert.equal(err.status, 503);
      assert.match(err.message, /照片儲存空間尚未設定/);
      assert.match(JSON.stringify(err.hint || err), /BLOB_READ_WRITE_TOKEN/);
      return true;
    });
  } finally {
    repo.__setBlobPut(null);
    process.env.BLOB_READ_WRITE_TOKEN = savedToken;
  }
});

test('insertFieldRecord() 送出的內容包含結構化欄位，且照片清單已清洗', async () => {
  const blobUrl = `${BLOB_BASE}/2026-11-14/1060-abc.jpg`;
  const { calls, restore } = stub(() => neonJson([{ id: 1, tree_no: '1060', photo_paths: [blobUrl] }]));
  try {
    const { record, errors } = repo.normalizeFieldRecord({
      tree_no: '1060',
      observer: '高三甲 12 號',
      health: '一般',
      bark_conditions: ['剝落', '黴斑'],
      surround_items: ['鄰近馬路', '排水口'],
      concrete_cover: '約一半',
      photo_paths: ['2026-09-26/1060-abc.jpg', '../etc/passwd', '/abs/x.jpg',
        'https://evil.example/x.jpg', blobUrl],
      photo_url: 'https://photos.example/ok.jpg',
    });
    assert.deepEqual(errors, [], `驗證不該出錯：${errors.join('／')}`);
    // 與 /api/field-records 的實際流程一致：先驗證正規化，再寫入
    const rec = await repo.insertFieldRecord(record);
    const call = calls.find((c) => c.query && /insert into public\.field_records/i.test(c.query.query));
    assert.ok(call, '必須用 INSERT 寫入 field_records');
    const sent = JSON.parse(call.query.params[0]);
    assert.deepEqual(sent.bark_conditions, ['剝落', '黴斑']);
    assert.deepEqual(sent.surround_items, ['鄰近馬路', '排水口']);
    assert.equal(sent.concrete_cover, '約一半');
    assert.deepEqual(sent.photo_paths, ['2026-09-26/1060-abc.jpg', blobUrl],
      '只留安全路徑與自家 Blob 網址（不得寫進 ../、絕對路徑或外部網址）');
    assert.equal(sent.photo_url, 'https://photos.example/ok.jpg');
    // 回傳值附上可直接顯示的公開網址
    assert.deepEqual(rec.photo_urls, [blobUrl]);
  } finally {
    restore();
  }
});

test('結構化欄位驗證：非法值回 400 並列出允許值；合法值原樣保留', () => {
  const bad = repo.normalizeFieldRecord({ observer: '甲', bark_conditions: ['樹皮爛掉'], surround_items: ['海邊'] });
  assert.ok(bad.errors.length >= 2, `應回報非法值，實際：${JSON.stringify(bad.errors)}`);
  assert.ok(bad.errors.some((e) => /樹皮狀況只接受/.test(e) && /白色鹽類結晶/.test(e)));
  assert.ok(bad.errors.some((e) => /周邊環境只接受/.test(e) && /排水口/.test(e)));

  const badCover = repo.normalizeFieldRecord({ observer: '甲', concrete_cover: '很多' });
  assert.ok(badCover.errors.some((e) => /水泥覆蓋範圍只接受/.test(e)));

  const good = repo.normalizeFieldRecord({
    observer: '甲',
    bark_conditions: ['黴斑', '黴斑', '白色鹽類結晶'],
    surround_items: ['鄰近建築物', '水泥覆蓋'],
    concrete_cover: '幾乎全部覆蓋',
  });
  assert.deepEqual(good.errors, []);
  assert.deepEqual(good.record.bark_conditions, ['黴斑', '白色鹽類結晶'], '重複值要去掉');
  assert.deepEqual(good.record.surround_items, ['鄰近建築物', '水泥覆蓋']);
  assert.equal(good.record.concrete_cover, '幾乎全部覆蓋');
  // 逗號字串（例如 CSV 匯入）也要能接受
  const csv = repo.normalizeFieldRecord({ observer: '甲', bark_conditions: '剝落、黴斑' });
  assert.deepEqual(csv.record.bark_conditions, ['剝落', '黴斑']);
});

test('listFieldRecords() 會把 photo_paths 轉成可顯示的公開網址', async () => {
  const a = `${BLOB_BASE}/2026-11-14/a.jpg`;
  const b = `${BLOB_BASE}/2026-11-14/b.jpg`;
  const { calls, restore } = stub(() => neonJson([
    { id: 1, tree_no: '1060', photo_paths: [a, b] },
    { id: 2, tree_no: '1061', photo_paths: [] },
  ]));
  try {
    const rows = await repo.listFieldRecords(10);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0].photo_urls, [a, b]);
    assert.deepEqual(rows[1].photo_urls, []);
    const sql = calls[0].query.query;
    assert.match(sql, /from public\.field_records/);
    assert.match(sql, /order by observed_on desc/);
  } finally {
    restore();
  }
});
