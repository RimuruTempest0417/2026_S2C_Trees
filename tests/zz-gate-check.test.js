import test from 'node:test';
import assert from 'node:assert/strict';

test('故意失敗：驗證 main 的 CI 守門', () => { assert.equal(1, 2); });
